//加载模块
const mysql=require("mysql")
//创建一个连接池对象
var pool=mysql.createPool({
  host:"127.0.0.1",     //链接mysql数据库的地址
  user:"root",          //链接mysql数据库用户名
  password:"",          //链接mysql数据库密码
  database:"xhs",   //操作数据库名字
  port:3306,            //端口号
  connectionLimit:10    //链接池里链接活动数量(连接池大小)
});
//导出
module.exports=pool;