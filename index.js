var express = require('express');
var app = express();
var path = require("path");
var fs = require("fs");
var mysql  = require('mysql');  
var bodyParser = require('body-parser');//解析,用req.body获取post参数
var http = require("http").createServer(app);
var io = require("socket.io")(http);
var username = {};
var usernameToClient = [];
var userandpass = false;
var rs;
//打开数据库
var connection = mysql.createConnection({     
  host     : 'localhost',       
  user     : 'root',              
  password : 'wanzhongke',
  port: '3306',                   
  database: 'userlogin'
});
connection.connect();
//连接数据  
var  sql = 'SELECT * FROM login where name='+"\""+username+"\"";
// var sql2 = 'select * from login where name="万仲科"';
connection.query(sql,function (err, result) {
  if(err){
    console.log('[SELECT ERROR] - ',err.message);
    rs = 'fail';
    return false; 
  } else if(result[0].name === username && result[0].password === password){
    console.log('yes');
    userandpass = true;
  } else {
    rs = 'fail';
  }
  if(userandpass && result[0].logined !==1) {
    console.log("logined true");
    rs = 'ok';
    console.log("rs is " + rs);
  } else if(userandpass) {
    console.log("logined false");
    rs = 'fail';
  }
});
connection.end();
// connection.connect();
// var storeData;
// var abc =function(username,password){

//     console.log("rs is " + rs);
//     return rs;
// };

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.use('/static', express.static(path.join(__dirname, 'public')));

//设置允许跨域访问该服务.
app.all('*', function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  // res.header('Access-Control-Allow-Origin', 'http://localhost:8080');
  //Access-Control-Allow-Headers ,可根据浏览器的F12查看,把对应的粘贴在这里就行
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', '*');
  res.header('Content-Type', 'application/json;charset=utf-8');
  next();
});
// app.get('/',function(req,res,next){
//      res.sendFile(__dirname + "/public/Component/login.html");
// });

// app.get('/chatHome',function(req,res){
//     res.sendFile(__dirname + "/public/Component/index.html");
// }); 
app.post('/Login',function(req,res){
  // console.log( "ddddddddddddd" +loginMng(req.body.username,req.body.password));
  if(rs === 'ok')
  {
    console.log("login ok");
    res.send("OK");
  }
  else
    res.send("fail");
})

// 用户上线处理
io.on("connection", function(socket) {
    socket.on('logined message',function(msg) {
        console.log(msg + " is connected.");

        username[socket.id] = msg;
        console.log(username);
        if(usernameToClient.indexOf(msg) === -1) {
          usernameToClient.push(msg);
        }

        let name ='./data/'+ msg +'.json';
        fs.readFile(name,'utf8',function (err, data) {
          if(err){
            console.log(err);
            fs.writeFile(name,"",function(err){
              if (err) {res.status(500).send('Data writting is error...')}
            });
          } else {
            if(data) {
              let d=JSON.parse(data);
              let sendData = JSON.stringify(d);
              io.sockets.connected[socket.id].emit('storeMessage',sendData);
              // console.log(sendData);
            }else
              console.log("json file is null.");
          }
        });

        console.log(usernameToClient);
        // 将用户列表发送到登录的id上
        io.sockets.connected[socket.id].emit('loginedUserList',usernameToClient);
        // console.log("the data is emit" + storeData);
        // io.sockets.connected[socket.id].emit('storeData',storeData);
        // 将自己的登录情况广播到其他用户
        socket.broadcast.emit('userManageAdd',username[socket.id]);
        storeData = '';
    });
    
    // 掉线情况处理
    socket.on('disconnect', function(){
        if(username.hasOwnProperty(socket.id)) {
            console.log(username[socket.id] + ' is disconnected');
            // 如果在线人数不为0，继续删掉下线的用户
            if(usernameToClient.length) {
                 usernameToClient = usernameToClient.filter( item => item !== username[socket.id]);
                io.emit('userManageDel',username[socket.id])
                delete username[socket.id];
                // io.emit('userManageDel',usernameToClient);
                console.log(username);
                return;
            }
            // 这是为0 的情况，直接删掉对象值即可，这里需要注意。
            delete username[socket.id];
            console.log(username);

        } else {
            console.log('user disconnected');
        }
        
    });
    // 会话处理
    socket.on('chat message', function(msg){
        data = '<div>' + '<h3>' + username[socket.id] + '</h3>' + '<span id="otherMsg">' + msg + '</span>' + '</div>';
        // 广播到其他用户
        socket.broadcast.emit('bradcast',data);
    });
    //私聊实现
    socket.on('privateChat',function(msg){ 
        // let socketId;
        for (const key in username) {
            data = '<div>' + '<h3>' + username[socket.id] + '</h3>' + '<span id="otherMsg">' + msg[1] + '</span>' + '</div>';
            if(username[key] === msg[0]){
                io.sockets.connected[key].emit('privateChat', [username[socket.id],msg[1]]);
            }
        }
    });
    socket.on('storeMessage',function(msg){
      let str = JSON.stringify(msg[1],null,"\t");
      let path = './data/'+msg[0]+'.json';
      fs.writeFile(path,str,function(err){
        if (err) {res.status(500).send('Data writting is error...')}
      });
      // console.log(msg);
    });
});

// 监听3000端口
http.listen(3000,function(){
    console.log("listening on *:3000");
});