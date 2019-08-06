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
// var userandpass = false;
// var rs;
//打开数据库
var pool = mysql.createPool({     
  host     : 'localhost',       
  user     : 'root',              
  password : 'wanzhongke',
  port: '3306',                   
  database: 'userlogin'
});
var query = function query(sql){
  return new Promise(function(resolve,reject){
    pool.getConnection(function(err,conn){
      if(err) {
        reject(err);
      }else {
        conn.query(sql,function(err,rows){
          if(err){
            reject(err);
          } else {
            resolve(rows);
            conn.release();
            // conn.end();
          }
        })
      }
    })
  })
}


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
 
app.post('/Login',function(req,res){
  let sql = 'select * from login where name='+'\"'+req.body.username+'\"';
  query(sql).then(function(rows){
    let username=req.body.username;
    let password=req.body.password;
    let isLogined=0;
    if(rows.length) {
      console.log(rows)
      if(rows[0].name===username&&rows[0].password===password&&rows[0].logined===isLogined){
        // rs='ok';
        res.send("OK");
        // 登录成功后，修改登录状态为1
        let sql = 'update login set logined=1 where name='+'\"'+username+'\"';
        query(sql).then(function(rows){
          console.log(rows);
        })
      } else {
        res.send("fail");
      }
    }
  });
});

app.post('/Register',function(req,res){
  let sql = 'select * from login where name='+'\"'+req.body.username+'\"';
  query(sql).then(function(rows){
    let username=req.body.username;
    let password=req.body.password;
    // let isLogined=0;
    console.log(rows);
    if(!rows.length) {
      let reg = 'insert into login (name, logined, password) values(' + '\"' + username +'\",' + 0 + ',\"'+password+'\"'+')';
      console.log(reg);
      query(reg)
      res.send("OK");
    } else {
      res.send("repeated");
    }
  });
});

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
                // io.emit('userManageDel',usernameToClient);
                let sql = 'update login set logined=0 where name='+'\"'+username[socket.id]+'\"';
                console.log(sql);
                query(sql).then(function(rows) {
                  console.log(rows);
                });
                delete username[socket.id];
                console.log(username);
                return;
            }
            // 退出登录后，修改数据库Logined 值为0
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