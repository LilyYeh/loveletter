const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const cardsData = {'衛兵':1,'神父':2,'男爵':3,'侍女':4,'王子':5,'國王':6,'伯爵夫人':7,'公主':8};
const rs = {};             //各房間裡的使用者(roomUsers)
const roomCards = {};      //各房間裡的<牌庫>
const roomPlayers = {};    //各房間裡的<玩家狀態(出局、出牌中)>
const roomUserCards = {};  //各房間裡的<玩家手上卡牌>

app.get('/', (req, res) => {
	res.sendFile( __dirname + '/playGround.html');
});

app.get('/enter', (req, res) => {
	res.sendFile( __dirname + '/enter.html');
});

app.get('/waiting', (req, res) => {
	res.sendFile( __dirname + '/waiting.html');
})

/*app.get('/game', (req, res) => {
	res.sendFile( __dirname + '/playGround.html');
});*/

// 當發生連線事件
io.on('connection', (socket) => {
	console.log(__dirname);
	console.log('connect success !!');

	// 當發生離線事件
	socket.on('disconnect', () => {
		//離開聊天室
		let thisUser = socket.id;
		let thisRoom = socket.room
		leaveAllRoom(thisUser);
		socket.leave(thisRoom);
		io.in(thisRoom).emit("system", {rs:rs[thisRoom]});
	});

	//加入聊天室
	socket.on('join', (data) => {
		let thisRoom = data['roomID'];
		let thisUserID = socket.id;
		let thisUserName = data['nickName'];

		//紀錄thisuser所在聊天室
		socket.room = thisRoom;
		//加入聊天室
		socket.join(thisRoom);
		if (!rs.hasOwnProperty(thisRoom)) {
			rs[thisRoom] = {};
		}
		rs[thisRoom][thisUserID] = thisUserName;
		socket.roomUsers = rs[thisRoom];
		console.log('join');
		//通知thisroom有新人加入
		io.in(thisRoom).emit('Waiting',{rs:rs[thisRoom],roomName:thisRoom});
	});

	//開始遊戲
	socket.on('start', (data) => {
		//重置牌庫
		let cards = ["衛兵","衛兵","衛兵","衛兵","衛兵","神父","神父","男爵","男爵","侍女","侍女","王子","王子","國王","伯爵夫人","公主"];
		shuffleCards(cards);
		removeCards(cards,3);

		//發牌給每個玩家，一人2張
		let thisRoom = socket.room
		let roomUsers = socket.roomUsers
		let userCards = {};
		let players = {}
		let i=0;
		for([userID, userName] of Object.entries(roomUsers)){
			//場中玩家 out:是否出局？ playing:我的回合？
			players[userID]={userName:userName,out:false,playing:false};

			if (!userCards.hasOwnProperty(userID)) {
				userCards[userID] = {userName:'',cards:[]};
			}
			userCards[userID]['userName'] = userName;
			userCards[userID]['maidProtect'] = false;
			userCards[userID]['cards'][0] = cards[0];
			cards.splice(0,1);
			i++;
		}

		//決定出牌者(依進入房間順序)
		players = setCurrentPlayer(0,players);

		//出牌者在牌堆抽一張牌
		let result = getCard(cards,userCards,players);
		cards = result.cards;
		userCards = result.userCards;

		//存 room data
		roomCards[thisRoom] = cards;
		roomPlayers[thisRoom] = players;
		roomUserCards[thisRoom] = userCards;

		cardsNum = cards.length;
		io.in(thisRoom).emit('getCards',{cardsNum:cardsNum,players:players,userCards:userCards});
	});

	//出牌
	socket.on('playCard', (data) => {
		const thisUserID = socket.id;
		const thisRoom = socket.room;
		const playCardName = data.playCardName;
		let cards = roomCards[thisRoom];
		let players = roomPlayers[thisRoom];
		let userCards = roomUserCards[thisRoom];
		let currentPlayerID = currentPlayer(players);
		//解除侍女保護
		if(userCards[currentPlayerID]['maidProtect']) userCards[currentPlayerID]['maidProtect']=false;
		switch(playCardName) {
			case '衛兵':
				const guessCardName = data.guessCardName;
				const guessPlayerID = data.guessPlayerID;
				const guessPlayerName = players[guessPlayerID]['userName'];
				const thisPlayerName = players[thisUserID]['userName'];
				var msg={}, winner;

				//侍女保護？
				if(userCards[guessPlayerID]['maidProtect']) {
					for([userID, userData] of Object.entries(players)){
						msg[userID] = guessPlayerName + '侍女保護，卡牌對他無效';
					}
					//下一回合
					var re = resetNextPlayer(thisRoom,thisUserID,playCardName,userCards,players,cards);
					io.in(thisRoom).emit('playResult',{
						playCardName:'衛兵',
						msg:msg,
						cardsNum:re.cards.length,
						players:re.players,
						userCards:re.userCards,
						winner:re.winner
					});
					break;
				}

				//猜測一名對手的手牌(不可猜衛兵)，猜測正確對方立刻出局
				if (userCards[guessPlayerID]['cards'][0] == guessCardName) {
					players[guessPlayerID]['out'] = true;
					for([userID, userData] of Object.entries(players)){
						msg[userID] = thisPlayerName + '猜中了' + guessPlayerName + '的卡牌，' + guessPlayerName + '出局！';
					}

					//統計場上的玩家
					winner = getWinner(players);
					if (winner) {
						io.in(thisRoom).emit('playResult', {
							playCardName:'衛兵',
							msg: msg,
							cardsNum:cards.length,
							players: players,
							userCards: userCards,
							winner: winner
						});
						break;
					}
				} else {
					for([userID, userData] of Object.entries(players)){
						msg[userID] = thisPlayerName + '沒猜中' + guessPlayerName + '的卡牌';
					}
				}

				//下一回合
				var re = resetNextPlayer(thisRoom,thisUserID,playCardName,userCards,players,cards);
				io.in(thisRoom).emit('playResult',{
					playCardName:'衛兵',
					msg:msg,
					cardsNum:re.cards.length,
					players:re.players,
					userCards:re.userCards,
					winner:re.winner
				});
				break;

			case '神父':
				const lookPlayerID = data.lookPlayerID;
				var msg={};

				//侍女保護？
				if(userCards[lookPlayerID]['maidProtect']) {
					for([userID, userData] of Object.entries(players)){
						msg[userID] = players[lookPlayerID]['userName'] + '侍女保護，卡牌對他無效';
					}
					//下一回合
					var re = resetNextPlayer(thisRoom,thisUserID,playCardName,userCards,players,cards);
					io.in(thisRoom).emit('playResult',{
						playCardName:'神父',
						msg:msg,
						cardsNum:re.cards.length,
						players:re.players,
						userCards:re.userCards,
						winner:re.winner
					});
					break;
				}

				//看一名玩家的手牌
				for([userID, userData] of Object.entries(players)){
					if(userID==currentPlayerID){
						msg[userID] = userCards[lookPlayerID]['userName'] + '的手牌：' + cardsData[userCards[lookPlayerID]['cards'][0]] + ' ' + userCards[lookPlayerID]['cards'][0];
					}else{
						msg[userID] = players[currentPlayerID]['userName'] + '查看' + players[lookPlayerID]['userName'] + '的手牌';
					}
				}

				//下一回合
				var re = resetNextPlayer(thisRoom,thisUserID,playCardName,userCards,players,cards);
				io.in(thisRoom).emit('playResult',{
					playCardName:'神父',
					msg:msg,
					cardsNum:re.cards.length,
					players:re.players,
					userCards:re.userCards,
					winner:re.winner
				});
				break;

			case '男爵':
				const comparePlayerID = data.comparePlayerID;
				var msg={};

				//侍女保護？
				if(userCards[comparePlayerID]['maidProtect']) {
					for([userID, userData] of Object.entries(players)){
						msg[userID] = players[comparePlayerID]['userName'] + '侍女保護，卡牌對他無效';
					}
					//下一回合
					var re = resetNextPlayer(thisRoom,thisUserID,playCardName,userCards,players,cards);
					io.in(thisRoom).emit('playResult',{
						playCardName:'男爵',
						msg:msg,
						cardsNum:re.cards.length,
						players:re.players,
						userCards:re.userCards,
						winner:re.winner
					});
					break;
				}

				//指定一名還沒出局的玩家，私下比較各自的手牌，數值較低的玩家直接出局，平手則無事發生
				var mycardNum = cardsData[userCards[currentPlayerID]['cards'][0]];
				var mycardName = userCards[currentPlayerID]['cards'][0];
				if(userCards[currentPlayerID]['cards'][0]==playCardName){
					mycardNum = cardsData[userCards[currentPlayerID]['cards'][1]];
					mycardName = userCards[currentPlayerID]['cards'][1];
				}
				if(mycardNum > cardsData[userCards[comparePlayerID]['cards'][0]]){
					players[comparePlayerID]['out'] = true;
					mymsg = players[comparePlayerID]['userName']+'出局';
				}else if(mycardNum < cardsData[userCards[comparePlayerID]['cards'][0]]){
					players[currentPlayerID]['out'] = true;
					mymsg = players[currentPlayerID]['userName']+'出局';
				}else{
					mymsg = '手牌一樣，平手';
				}
				for([userID, userData] of Object.entries(players)){
					if(userID==currentPlayerID){
						msg[userID] = userCards[currentPlayerID]['userName'] + '的手牌：' + mycardNum + mycardName + '；<br>' +
									  userCards[comparePlayerID]['userName'] + '的手牌：' + cardsData[userCards[comparePlayerID]['cards'][0]] + userCards[comparePlayerID]['cards'][0] + '；<br>' +
									  mymsg;
					}else{
						msg[userID] = players[currentPlayerID]['userName'] + '和' + players[comparePlayerID]['userName'] + '比較手牌大小，'+ mymsg;
					}
				}

				//統計場上的玩家
				winner = getWinner(players);
				if (winner) {
					io.in(thisRoom).emit('playResult', {
						playCardName:'男爵',
						msg: msg,
						cardsNum:cards.length,
						players: players,
						userCards: userCards,
						winner: winner
					});
					break;
				}

				//下一回合
				var re = resetNextPlayer(thisRoom,thisUserID,playCardName,userCards,players,cards);
				io.in(thisRoom).emit('playResult',{
					playCardName:'男爵',
					msg:msg,
					cardsNum:re.cards.length,
					players:re.players,
					userCards:re.userCards,
					winner:re.winner
				});
				break;

			case '侍女':
				//到下個自己的回合之前，所有玩家的牌都對你無效
				userCards[currentPlayerID]['maidProtect'] = true;

				var msg={};
				for([userID, userData] of Object.entries(players)){
					msg[userID] = players[currentPlayerID]['userName']+'侍女保護中，所有玩家的牌都對他無效';
				}

				//下一回合
				var re = resetNextPlayer(thisRoom,thisUserID,playCardName,userCards,players,cards);
				io.in(thisRoom).emit('playResult',{
					playCardName:'侍女',
					msg:msg,
					cardsNum:re.cards.length,
					players:re.players,
					userCards:re.userCards,
					winner:re.winner
				});
				break;

			case '王子':
				const drawPlayerID = data.drawPlayerID;
				var msg={};

				//侍女保護？
				if(userCards[drawPlayerID]['maidProtect']) {
					for([userID, userData] of Object.entries(players)){
						msg[userID] = players[drawPlayerID]['userName'] + '侍女保護，卡牌對他無效';
					}
					//下一回合
					var re = resetNextPlayer(thisRoom,thisUserID,playCardName,userCards,players,cards);
					io.in(thisRoom).emit('playResult',{
						playCardName:'王子',
						msg:msg,
						cardsNum:re.cards.length,
						players:re.players,
						userCards:re.userCards,
						winner:re.winner
					});
					break;
				}

				if(userCards[drawPlayerID]['cards'][0]=='公主'){
					players[drawPlayerID]['out'] = true;
					for([userID, userData] of Object.entries(players)){
						msg[userID] = players[drawPlayerID]['userName']+'打出公主，出局！';
					}

					//統計場上的玩家
					winner = getWinner(players);
					if (winner) {
						io.in(thisRoom).emit('playResult', {
							playCardName:'王子',
							msg: msg,
							cardsNum:cards.length,
							players: players,
							userCards: userCards,
							winner: winner
						});
						break;
					}
				}else{
					userCards[drawPlayerID]['cards'][0]=cards[0];
					cards.splice(0,1);
					for([userID, userData] of Object.entries(players)){
						msg[userID] = players[drawPlayerID]['userName']+'棄掉手牌，再抽一張';
					}
				}

				//下一回合
				var re = resetNextPlayer(thisRoom,thisUserID,playCardName,userCards,players,cards);
				io.in(thisRoom).emit('playResult',{
					playCardName:'王子',
					msg:msg,
					cardsNum:re.cards.length,
					players:re.players,
					userCards:re.userCards,
					winner:re.winner
				});
				break;

			case '國王':
				const changePlayerID = data.changePlayerID;
				var msg={};
				console.log(players)
				//侍女保護？
				if(userCards[changePlayerID]['maidProtect']) {
					for([userID, userData] of Object.entries(players)){
						msg[userID] = players[changePlayerID]['userName'] + '侍女保護，卡牌對他無效';
					}
					//下一回合
					var re = resetNextPlayer(thisRoom,thisUserID,playCardName,userCards,players,cards);
					io.in(thisRoom).emit('playResult',{
						playCardName:'國王',
						msg:msg,
						cardsNum:re.cards.length,
						players:re.players,
						userCards:re.userCards,
						winner:re.winner
					});
					break;
				}

				//和一名尚未出局的對手交換手牌
				var mycardIndex = 0;
				var myCard = userCards[currentPlayerID]['cards'][0];
				if(userCards[currentPlayerID]['cards'][0]==playCardName){
					mycardIndex = 1;
					myCard = userCards[currentPlayerID]['cards'][1];
				}
				userCards[currentPlayerID]['cards'][mycardIndex] = userCards[changePlayerID]['cards'][0];
				userCards[changePlayerID]['cards'][0] = myCard;
				for([userID, userData] of Object.entries(players)){
					msg[userID] = players[currentPlayerID]['userName']+'與'+players[changePlayerID]['userName']+'交換手牌';
				}

				//下一回合
				var re = resetNextPlayer(thisRoom,thisUserID,playCardName,userCards,players,cards);
				io.in(thisRoom).emit('playResult',{
					playCardName:'國王',
					msg:msg,
					cardsNum:re.cards.length,
					players:re.players,
					userCards:re.userCards,
					winner:re.winner
				});
				break;

			case '伯爵夫人':
				var msg={};
				for([userID, userData] of Object.entries(players)){
					msg[userID] = players[currentPlayerID]['userName'] + '棄掉伯爵夫人手牌';
				}

				//下一回合
				var re = resetNextPlayer(thisRoom,thisUserID,playCardName,userCards,players,cards);
				io.in(thisRoom).emit('playResult',{
					playCardName:'伯爵夫人',
					msg:msg,
					cardsNum:re.cards.length,
					players:re.players,
					userCards:re.userCards,
					winner:re.winner
				});
				break;

			case '公主':
				var msg={};
				players[currentPlayerID]['out'] = true;
				for([userID, userData] of Object.entries(players)){
					msg[userID] = players[currentPlayerID]['userName']+'打出公主，出局！';
				}

				//統計場上的玩家
				winner = getWinner(players);
				if (winner) {
					io.in(thisRoom).emit('playResult', {
						playCardName:'公主',
						msg: msg,
						cardsNum:cards.length,
						players: players,
						userCards: userCards,
						winner: winner
					});
					break;
				}

				//下一回合
				var re = resetNextPlayer(thisRoom,thisUserID,playCardName,userCards,players,cards);
				io.in(thisRoom).emit('playResult',{
					playCardName:'公主',
					msg:msg,
					cardsNum:re.cards.length,
					players:re.players,
					userCards:re.userCards,
					winner:re.winner
				});
				break;

			default:
		}

	});

	/*socket.on('setCurrentPlayer', (data) => {
		socket.players = setCurrentPlayer(1,socket.players);
	});*/
});

server.listen(3000, () => {
	console.log("Server Started. http://lilyyeh.ga:3000");
});

function leaveAllRoom(user){
	for(r in rs) {
		delete rs[r][user];
		if(Object.keys(rs[r]).length==0){
			delete rs[r];
		}
	}
	//console.log(rs);
}

function shuffleCards(arr){
	for(let i = arr.length - 1; i > 0; i--){
		const j = Math.floor(Math.random() * (i+1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

function removeCards(arr,rmNum){
	arr.splice(0,rmNum);
	return arr;
}

//棄掉打出的手牌(已使用)
function dealCard(playCardName,thisUserID,userCards){
	//console.log('執行 dealCard Start');
	let i = 0;
	for(card of userCards[thisUserID]['cards']){
		if(card==playCardName){
			userCards[thisUserID]['cards'].splice(i,1);
		}
		i++;
	}
	//console.log('執行 dealCard End');
	return userCards;
}

function setCurrentPlayer(num,players){
	//console.log('執行 setCurrentPlayer Start');
	const countPlayers = Object.keys(players).length;
	var count=0, countLeftPlayer=0, next=false, out, playing;
	for([userID, userData] of Object.entries(players)){
		out = userData['out'];
		//if(count==3) out = players[userID]['out']=true;

		count++;
		if(out && !userData['playing']) continue;

		playing = userData['playing'];
		if(num==0){ //開局
			players[userID]['playing']=true;
			break;
		}else if(!out && next){
			players[userID]['playing']=true;
		}else{
			players[userID]['playing']=false;
		}

		next = false;
		if(playing){
			next = true;
		}

	}
	if(next) {
		for([userID, userData] of Object.entries(players)) {
			out = userData['out'];
			if(!out){
				players[userID]['playing']=true;
				break;
			}
		}
	}
	console.log(players);
	//console.log('執行 setCurrentPlayer End');
	return players;
}

function getCard(cards,userCards,players){
	//console.log('執行 getCard Start');
	for([userID, userData] of Object.entries(userCards)){
		if(players[userID]['playing']){
			userCards[userID]['cards'][1]=cards[0];
			cards.splice(0,1);
		}
	}
	//console.log('執行 getCard End');
	return {cards:cards,userCards:userCards};
}

function resetNextPlayer(thisRoom,thisUserID,playCardName,userCards,players,cards){
	var winner=false;

	//棄掉此手牌(已使用)
	userCards = dealCard(playCardName,thisUserID,userCards);

	if(cards.length>0){
		//決定下一位出牌者(依進入房間順序)
		players = setCurrentPlayer(1,players);

		//出牌者在牌堆抽一張牌
		var re = getCard(cards,userCards,players);
		cards = re.cards;
		userCards = re.userCards;
	}else{
		//剩餘玩家比較手牌大小
		var max = 0;
		for([userID, userData] of Object.entries(players)){
			if(!userData['out']){
				if(cardsData[userCards[userID]['cards'][0]] > max){
					max = cardsData[userCards[userID]['cards'][0]];
					winner = userID;
				}
			}
		}
	}

	//存 room data
	roomCards[thisRoom] = cards;
	roomPlayers[thisRoom] = players;
	roomUserCards[thisRoom] = userCards;
	return {cards:cards,players:players,userCards:userCards,winner:winner};
}

function getWinner(players){
	let leftPlayers = {};
	for([userID, userData] of Object.entries(players)) {
		if(!userData['out']){
			leftPlayers[userID]=userData['userName'];
		}
	}
	if(Object.keys(leftPlayers).length==1){
		return Object.keys(leftPlayers)[0];
	}
	return 0;
}

function currentPlayer(players){
	var currentPlayer = '';
	for([userID, userData] of Object.entries(players)) {
		if(userData['playing']){
			currentPlayer = userID;
		}
	}
	return currentPlayer;
}
