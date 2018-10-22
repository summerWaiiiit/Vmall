//1.加载相应模块
const express = require("express")
const bodyParser = require("body-parser");
// const fs=require("fs")
// const multer=require("multer")
const pool = require("./pool");
const request = require("request");
//2.创建express对象
var app = express();
//3.指定静态目录
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.urlencoded({ extended: false }));
//4.启动监听端口
app.listen(3000);
app.get("/list", (req, res) => {  //获取文章列表
  // var id = req.query.id;
  // if(!id){
  //   return res.send('缺少参数');
  // }

  let offset = req.query.offset || 0;
  let limit = req.query.limit || 100;

  var query = pool.query('select * from red_book limit ?, ?', [offset, limit], (err, result) => {
    if (err) {
      console.log(err);
      res.send('数据库异常');
    }

    let list = {};
    for (let key in result) {
      if (result.hasOwnProperty(key)) {
        let content = result[key];
        if (content.hasOwnProperty('id')) {
          list[content['id']] = content;
        }
      }
    }
    console.log(Object.keys(list));

    pool.query('select * from release_imgs where `content-id` in(?) and is_cover = 2', [Object.keys(list)], (err, result) => {
      console.log(result);
      for (let key in result) {
        if (result.hasOwnProperty(key)) {
          let info = result[key];
          if (info.hasOwnProperty('content-id') && list.hasOwnProperty(info['content-id'])) {
            list[info['content-id']]['cover'] = info;
          }
        }
      }

      res.send(list);
    });

  });


})


app.get('/content', (request, response) => {  //获取文章内容
  let id = request.query.id;
  if (!id) {
    return response.send({ msg: "缺少参数" });
  }

  pool.query('select * from red_book where id = ?', [id], (err, result) => {
    if (err) {
      return response.send({ msg: "数据库异常" });
    }

    let content = {
      content: result.shift()
    }

    pool.query('select * from release_imgs where `content-id` = ?', [id], (err, result) => {
      if (err) {
        return response.send({ msg: "数据库异常" });
      }

      content.images = result;
      response.send(content);
    })

  })
});

app.post('/login', (req, res) => { //用户登录
  if (!req.body.code) {
    return res.send({ code: 1, msg: "缺少用户登录凭证" });
  }

  request.get('https://api.weixin.qq.com/sns/jscode2session',
    { qs: { appid: '', secret: '', js_code: req.body.code, grant_type: 'authorization_code' } },
    function (error, response, body) {
      if (error) {
        console.log(error);
        return res.send({ code: 1, msg: '请求微信接口失败' });
      }

      console.log(body);
      let apiResult = JSON.parse(body);
      if (apiResult.errcode != 0 && apiResult.errMsg) {
        return res.send({ code: 1, msg: apiResult.errMsg });
      }

      if (!apiResult.open_id || !apiResult.session_key || !apiResult.unionid) {
        pool.query('select * from user_info where open_id = ? and unionid = ?', [apiResult.open_id, apiResult.unionid], (err, result) => {
          if (err) {
            console.log(err);
            return res.send({ code: 1, msg: '数据库异常' });
          }
          if (result.length > 0) {
            let userInfo = result[0];
            pool.query('update user_info set session_key = ?', [apiResult.session_key], (err, result) => {
              if (err) {
                console.log(err);
                return res.send({ code: 1, msg: '数据库异常' });
              }

              userInfo.session_key = apiResult.session_key;

              return res.send({ code: 0, result: userInfo });
            });
          } else {
            pool.query('insert into user_info set ?', { open_id: apiResult.open_id, unionid: apiResult.unionid }, (err, result) => {
              if (err) {
                console.log(err);
                return res.send({ code: 1, msg: '数据库异常' });
              }

              if (result.insertId > 0) {
                pool.query('select * from user_info where user_id = ?', [result.insertId], (err, result) => {
                  if (err || result.length < 1) {
                    console.log(err);
                    return res.send({ code: 1, msg: '数据库异常' });
                  }

                  return res.send({ code: 0, result: result[0] });
                });
              }
            });
          }
        });
      } else {
        return res.send({ code: 1, msg: '请求微信接口失败' });
      }
    });

});

app.get('/favorite', (req, res) => { //获取收藏列表
  if (!req.query.session_key) {
    return res.send({ code: 1, msg: '缺少会话KEY' });
  }

  pool.query('select * from user_info where session_key = ?', [req.body.session_key], (err, results) => {
    if (err) {
      console.log(err);
      return res.send({ code: 1, msg: '数据库异常' });
    }

    if (results.length < 1) {
      return res.send({ code: 1, msg: "用户不存在" });
    }

    let userInfo = results[0];
    pool.query('select * from favorite where user_id = ?', [userInfo.user_id], (err, results) => {
      if (err) {
        console.log(err);
        return res.send({ code: 1, msg: '数据库异常' });
      }

      return res.send({ code: 0, result: results });
    });
  });

});


app.post('/favorite', (req, res) => { //添加或删除收藏
  if (!req.body.session_key) {
    return res.send({ code: 1, msg: '缺少会话KEY' });
  }

  if (!req.body.content_id) {
    return res.send({ code: 1, msg: "缺少内容编号" });
  }

  pool.query('select * from user_info where session_key = ?', [req.body.session_key], (err, results) => {
    if (err) {
      console.log(err);
      return res.send({ code: 1, msg: '数据库异常' });
    }

    if (results.length < 1) {
      return res.send({ code: 1, msg: "用户不存在" });
    }

    let userInfo = results[0];
    pool.query('select * from favorite where user_id = ? and content = ?', [userInfo.user_id, req.body.content_id], (err, results) => {
      if (err) {
        console.log(err);
        return res.send({ code: 1, msg: '数据库异常' });
      }

      if (results.length > 0) {
        let favorite = results[0];
        pool.query('delete from favorite where favorite_id = ?', [favorite.favorite_id], (err, result) => {
          if (err) {
            console.log(err);
            return res.send({ code: 1, msg: '数据库异常' });
          }

          return res.send({ code: 0, result: -1 });
        });
      } else {
        pool.query('insert into favorite set user_id = ?, content_id = ?', [userInfo.user_id, req.body.content_id], (err, result) => {
          if (err) {
            console.log(err);
            return res.send({ code: 1, msg: '数据库异常' });
          }

          return res.send({ code: 0, result: result.insertId });
        });
      }
    });
  });

});

app.get("/product/:id?", (req, res) => {
  if (req.params.id) {
    pool.query(
      "select * from shoplist where id = ? limit 1",
      [req.params.id],
      (err, results) => {
        if (err) {
          console.log(err);
          return res.send({ code: 1, msg: "数据库异常" });
        }

        if (results.length > 0) {
          let product = results[0];
          pool.query(
            "select * from shop_images where commodity_id = ?",
            [product.id],
            (err, results) => {
              if (err) {
                console.log(err);
                return res.send({ code: 1, msg: "数据库异常" });
              }

              product.images = results;
              return res.send({ code: 0, result: product });
            }
          );
        } else {
          return res.send({ code: 0, result: null });
        }
      }
    );
  } else {
    let limit = req.query.limit || 30;
    let offset = req.query.offset || 0;
    pool.query(
      "select * from shoplist limit ?, ?",
      [offset, limit],
      (err, results) => {
        if (err) {
          console.log(err);
          return res.send({ code: 1, msg: "数据库异常" });
        }

        // console.log(results);

        if (results.length > 0) {
          let products = {};
          for (const key in results) {
            if (results.hasOwnProperty(key)) {
              const product = results[key];
              products[product.id] = product;
            }
          }

          pool.query(
            "select * from shop_images where commodity_id in(?) and is_cover = 2",
            [Object.keys(products)],
            (err, results) => {
              // console.log(results);
              if (err) {
                console.log(err);
                return res.send({ code: 1, msg: "数据库异常" });
              }

              for (const key in results) {
                if (results.hasOwnProperty(key)) {
                  const image = results[key];
                  if (products.hasOwnProperty(image.commodity_id)) {
                    products[image.commodity_id].cover = image;
                  }
                }
              }

              return res.send({ code: 0, result: products });
            }
          );
        } else {
          return res.send({ code: 0, result: [] });
        }
      }
    );
  }
});