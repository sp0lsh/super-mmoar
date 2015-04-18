var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

var playerCounter = 0;

io.on('connection', function(socket){
    var playerState = {
        id: playerCounter++,
        state: 'playing',
        top: 200 + 200 * Math.random(),
        left: 200 + 200 * Math.random(),
        width: 10,
        height: 10,
        color: '#000000',
        speed: 10.0
    };
    
    io.emit('playerState', playerState);
    
    console.log('user #' + playerState.id + ' connected' );
  
    socket.on('input', function(input){
            // console.log('input', input.left, input.right, input.up, input.down);
        var xDelta = 0;
        var yDelta = 0;
       
        // console.log(keysPressed);
       
        if (input.up){
           yDelta -= playerState.speed;
        }
        if (input.down){
           yDelta += playerState.speed;
        }
        if (input.left){
           xDelta -= playerState.speed;
        }
        if (input.right){
           xDelta += playerState.speed;
        }
       
        playerState.left += xDelta;
        playerState.top += yDelta;
       
        io.emit('playerState', playerState);
    });
  
    // socket.on('chat message', function(msg){
    //     console.log('message: ' + msg);
    //     io.emit('chat message', msg);
    // });
  
    socket.on('disconnect', function(){
        console.log('user disconnected');
        playerState.state = 'quit';
        io.emit('playerState', playerState);
    });
});

http.listen(3000, '0.0.0.0', function(){
    console.log('listening on *:3000');
});