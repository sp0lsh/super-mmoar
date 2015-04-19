var _ = require('underscore')();
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var sm = new SM();

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});




/// SUPER MMOAR MANAGER
function SM () {
    // collections
    this.grid = {};   
    this.units = [];
    this.aiUnits = [];
    
    /// consts
    this.GRID_SIZE = 200;
    this.BOT_QUOTA = 100;
    this.TEAM_BLUE = 'blue';
    this.TEAM_RED = 'red';
    this.TEAM_COLOR = {
        'blue': '#0000FF',
        'red':  '#FF0000'
    };
    
    /// varying
    this.playerCounter = 0;
    this.unitCounter = 0;
    
    this.blueTeamCounter = 0;
    this.redTeamCounter = 0;
    
    
    console.log('SM created', this);
};
var SMProto = SM.prototype;

SMProto.init = function() {
    // crate bots
    for (var i = 0; i < this.BOT_QUOTA; i++) {
        
        var unit = this.createPlayer({
                name: 'bot' + i
            },
            null
        );
        
        this.addUnitToWorld(unit);
        this.aiUnits.push(unit);
    }
    
    console.log(this.grid);
};

SMProto.worldToGridCoords = function(x, y) {
    
    var gridSize = this.GRID_SIZE;
    
    if ( gridSize % 2 != 0 ) {
        console.error('gridSize not dividable by 2!');
    }
    
    var gridHalf = gridSize / 2;
    
    var gridX = Math.floor((x + gridHalf)/gridSize);
    var gridY = Math.floor((y + gridHalf)/gridSize);
   
    return {
        x: gridX,
        y: gridY
    };
}

SMProto.gridToWorldCoords = function (x, y) {
    
    var gridSize = this.GRID_SIZE;
  
    if ( gridSize % 2 != 0 ) {
        console.error('gridSize not dividable by 2!');
    }

    var worldX = (x * gridSize);
    var worldY = (y * gridSize);

    return {
        x: worldX,
        y: worldY
    };
}


SMProto.createPlayer = function (data, socket) {
    
    console.log( 'creating player', data);
    if (this.blueTeamCounter > this.redTeamCounter) {
        data.team = sm.TEAM_RED;
    } else if (this.blueTeamCounter < this.redTeamCounter) {
        data.team = sm.TEAM_BLUE;
    } else {
        data.team = (Math.random() > 0.5 ? sm.TEAM_BLUE : sm.TEAM_RED);
    }
    
    if (data.team == sm.TEAM_RED) {
        this.redTeamCounter++;
    } else {
        this.blueTeamCounter++;
    }
    
    var player = new Player(
        this.playerCounter++,
        data,
        socket
    );
    
    var unit = new Unit(
        this.unitCounter++,
        data,
        socket
    );
    
    unit.player = player;
    player.unit = unit;
    
    player.connected(data);
    
    unit.position = {
        x: Math.round(5 * sm.playerCounter * (2 * Math.random() - 0.5)),
        y: Math.round(5 * sm.playerCounter * (2 * Math.random() - 0.5))
    };
    
    
    this.units.push(unit);
    
    console.log( 'player created', this.units.length, unit.id);
    
    return unit;
};

SMProto.destroyPlayer = function (unit) {
    
    if (unit) {
        console.log('destroying #' + unit.id);
        
        this.removeUnitFromWorld(unit);
        unit.player.disconnected();
        unit.destroy();
        
    } else {
        console.log('### disconnected socket with null unit!');
    }
};

SMProto.addUnitToWorld = function (unit) {
    
    var positionGrid = this.worldToGridCoords(unit.position.x, unit.position.y);
    
    // console.log( 'adding unit to grid', positionGrid, unit.position);
    
    if (!this.grid[positionGrid.x]) {
        this.grid[positionGrid.x] = {};
    }
    
    if (!this.grid[positionGrid.x][positionGrid.y]) {
        this.grid[positionGrid.x][positionGrid.y] = {};
    }
    
    if (!this.grid[positionGrid.x][positionGrid.y].units) {
        this.grid[positionGrid.x][positionGrid.y].units = [];
    }
    
    this.grid[positionGrid.x][positionGrid.y].units.push(unit);
};

SMProto.removeUnitFromWorld = function (unit) {
    
    var positionGrid = this.worldToGridCoords(unit.position.x, unit.position.y);
    
    // console.log( 'remove unit from grid', positionGrid, unit.position);
    
    var unitsCell = this.grid[positionGrid.x][positionGrid.y].units;
    unitsCell.splice(unitsCell.indexOf(unit), 1);
};

SMProto.moveUnit = function (unit, xDelta, yDelta) {
    
    // var oldPositionGrid = this.worldToGridCoords(unit.position.x, unit.position.y);
    
    this.removeUnitFromWorld(unit);
    
    unit.position.x += xDelta;
    unit.position.y += yDelta;
    
    this.addUnitToWorld(unit);
    
    unit.updateAdjUnits();
};

SMProto.updateAI = function () {
    var that = this;
    this.aiUnits.forEach(function(unit) {
        
        var xDelta = 0;
        var yDelta = 0;
        
        var isMovingX = Math.random() > 0.5;
        if (isMovingX) {
            var xDelta = (Math.random() > 0.5 ? 1 : -1);
        }
        
        var isMovingY = Math.random() > 0.5;
        if (isMovingY) {
            var yDelta = (Math.random() > 0.5 ? 1 : -1);
        }
        
        if (isMovingX || isMovingY) {
            that.moveUnit(unit, xDelta * 5 * Math.random(), yDelta * 5 * Math.random());
        }
    });
};

SMProto.sendSnapshot = function () {
    
    var that = this;
    
    this.units.forEach(function(unit) {
        if (!unit.player.isAI) {
            // console.log('<<< debug', that.grid);
            // unit.socket.emit('debug', that.grid);
            
            var unitsState = [];
            
            unit.adjUnits.forEach(function(adjUnit) {
                var packet = {
                    id:adjUnit.id,
                    color: adjUnit.color,
                    position: adjUnit.position
                };
                
                unitsState.push(packet);
            });
            
            // console.log('update state unit', unit.id, unit.adjUnits);
            
            if (unitsState.length) {
                var snapshot = { 
                    red: sm.redTeamCounter,
                    blue : sm.blueTeamCounter,
                    units: unitsState
                };
                // console.log('>>> snapshot for #' + unit.id, snapshot);
                unit.socket.emit('snapshot', snapshot);
            }
        }
    });
};

/// PLAYER
function Player (id, data, socket) {
    this.id = id;
    this.unit = null;
    this.isAI = (socket == null);
    this.name = data.name;
    this.team = data.team;
};
var PProto = Player.prototype;

PProto.connected = function (data) {
    // get state from db
    console.log('player connected', this.id, data);
};

PProto.disconnected = function () {
    // save state in db
    console.log('player disconnected', this.id);
};

/// UNIT
function Unit (id, data, socket) {
    this.id = id;
    this.player = null;
    this.socket = socket;
    this.speed = 1;
    this.postion = { 
        x: 0,
        y: 0
    };
    this.color = sm.TEAM_COLOR[data.team];
    this.adjUnits = [];
};

var UProto = Unit.prototype;
UProto.updateAdjUnits = function () {
    
    var that = this;
    // We have two lists
    // There is a list of units we currently have, and a list that we will have once we recalculate
    // If an item is in the first list, but no longer in the second list, do removeOtherUnit
    // If an item is in the first & second list, don't do anything
    // If an item is only in the last list, do addOtherUnit
    var firstList = this.adjUnits;
    var secondList = [];
    
    // Check for all players that are nearby and add them to secondList
    var gridPosition = sm.worldToGridCoords(this.position.x, this.position.y);
    
    // console.log('updateAdjUnits', gridPosition);
    var cx = gridPosition.x;
    var cy = gridPosition.y;
    
    for (var x = cx - 1; x <= cx + 1; x++) {
        for (var y = cy - 1; y <= cy + 1; y++) {
            
            if (   sm.grid[x]
                && sm.grid[x][y]
                && sm.grid[x][y].units ) {
                
                sm.grid[x][y].units.forEach(function(adjUnit) {
                    // console.log('found in cell', adjUnit.id);
                    if (adjUnit.id !== that.id) {
                        secondList.push(adjUnit);
                    }    
                });
            }
        }
    }
    
    for (var i = 0; i < firstList.length; i++) {
        if (secondList.indexOf(firstList[i]) === -1) {
            // Not found in the second list, so remove it
            that.removeAdjUnit(firstList[i]);
        }
    }
    for (var i = 0; i < secondList.length; i++) {
        if (firstList.indexOf(secondList[i]) === -1) {
            // Not found in the first list, so add it
            that.addAdjUnit(secondList[i]);
        }
    }
};

UProto.removeAdjUnit = function (adjUnit) {
    this.adjUnits.splice(this.adjUnits.indexOf(adjUnit), 1);
    
    if (this.socket) {
        this.socket.emit('removeUnit', {
           id: adjUnit.id
        });
    }
};

UProto.addAdjUnit = function (adjUnit) {
    this.adjUnits.push(adjUnit);
    
    if (this.socket) {
        this.socket.emit('addUnit', {
            id: adjUnit.id,
            color: adjUnit.color,
            position: adjUnit.position
        });
    }
};

UProto.destroy = function () {
    console.log('unit destroyed', this.id);
};


io.on('connection', function(socket){
    socket.unit = null;
    socket.on('connectServer', function(data, reply){
        console.log('>>> connectServer', data);
        socket.unit = sm.createPlayer(data, socket);
        sm.addUnitToWorld(socket.unit);
        socket.unit.updateAdjUnits();
        
        var state = {
            id: socket.unit.id,
            position: socket.unit.position
        };
        // console.log('<<< state', state);
        socket.emit('state', state);
    });
    
    socket.on('input', function(input) {
            // console.log('input', input.left, input.right, input.up, input.down);
        var unit = socket.unit;
        if (unit) {
            // console.log('>>> input', input);
            var xDelta = 0;
            var yDelta = 0;
           
            // console.log(keysPressed);
           
            if (input.up) {
               yDelta -= unit.speed;
            }
            
            if (input.down) {
               yDelta += unit.speed;
            }
            
            if (input.left) {
               xDelta -= unit.speed;
            }
            
            if (input.right) {
               xDelta += unit.speed;
            }
           
            sm.moveUnit(unit, xDelta, yDelta);
            
            var state = {
                id: socket.unit.id,
                color: unit.color,
                position: socket.unit.position
            };
            
            // console.log('<<< state', state);
            socket.emit('state', state);
        }
        // io.emit('playerState', playerState);
    });
    
    socket.on('disconnect', function(data){
        console.log('>>> disconnect', socket.unit);
        sm.destroyPlayer(socket.unit);
        //
        // io.emit('playerState', playerState);
    });
});


sm.init();

var interval = setInterval(function (sm) {
    
    sm.updateAI();
    sm.sendSnapshot();
    
}, 500, sm);


http.listen(3000, '0.0.0.0', function(){
    console.log('listening on *:3000');
});