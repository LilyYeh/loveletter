let data = {
	domain: "/loveletter/assets",
	title: "線上玩 桌遊 情書",
	cardsData: {'衛兵':1,'神父':2,'男爵':3,'侍女':4,'王子':5,'國王':6,'伯爵夫人':7,'公主':8},
	roomName: 'room1',
	userName: 'LilyYeh',
	userID: '',             //socket.id
	roomUsers: {},          //所有玩家
	players: {},            //場上剩餘玩家
	cardsNum:0,             //牌庫剩餘張數
	cards:{0:'',1:''},      //我的卡牌
	playCardName:'',        //手牌角色
	currentplay:false,      //我的回合

	//login畫面/等待玩家畫面/遊戲畫面
	showEnter:true,
	showWaiting:false,
	showGameTable:false,

	//回合結束，結果
	showPlayResult:false,
	msg:'',
	msg2:'',
	h1:'遊戲繼續',
	winner:'',
	playerCardName:'',

	//衛兵 #guard
	showGuard:false,
	guessPlayerID:'',

	//神父
	showPriest:false,

	//男爵
	showLord:false,

	//侍女
	showMaid:false,
	maidProtect:false,

	//王子
	showPrince:false,

	//國王
	showKing:false,

	//伯爵夫人
	showCountess:false,

	//公主
	showPrincess:false
}

let socket = io();
let vm = new Vue({
	el: "#playGround",
	data: data,
	methods: {
		/*setCurrentPlayer() {
			socket.emit("setCurrentPlayer");
		},*/
		enterRoom() {
			socket.emit("join", {"roomID":this.roomName,"nickName":this.userName});
		},
		startGame() {
			socket.emit("start");
		},
		chooseCard(cardNum) {
			if(!this.currentplay){
				return false;
			}
			this.showPlayResult=false;

			this.playCardName = this.cards[cardNum];
			this.showGuard=false;
			this.showPriest=false;
			this.showLord=false;
			this.showMaid=false;
			this.maidProtect=false;
			this.showPrince=false;
			this.showKing=false;
			this.showCountess=false;
			this.showPrincess=false;
			switch(this.playCardName) {
				case '衛兵':
					this.showGuard=true;
					break;
				case '神父':
					this.showPriest=true;
					break;
				case '男爵':
					this.showLord=true;
					break;
				case '侍女':
					this.showMaid=true;
					break;
				case '王子':
					this.showPrince=true;
					break;
				case '國王':
					this.showKing=true;
					break;
				case '伯爵夫人':
					this.showCountess=true;
					break;
				case '公主':
					this.showPrincess=true;
					break;
			}
		},
		guessCard(guessCardName) {
			socket.emit("playCard",{"playCardName":"衛兵","guessPlayerID":this.guessPlayerID,"guessCardName":guessCardName});
		},
		lookCard(lookPlayerID){
			socket.emit("playCard",{"playCardName":"神父","lookPlayerID":lookPlayerID});
		},
		compareCard(comparePlayerID){
			socket.emit("playCard",{"playCardName":"男爵","comparePlayerID":comparePlayerID});
		},
		maidProtectCard(){
			socket.emit("playCard",{"playCardName":"侍女"});
		},
		drawCard(drawPlayerID){
			socket.emit("playCard",{"playCardName":"王子","drawPlayerID":drawPlayerID});
		},
		changeCard(changePlayerID){
			socket.emit("playCard",{"playCardName":"國王","changePlayerID":changePlayerID});
		},
		discardCard(){
			/*var i=0;
			for(card of this.cards){
				if(card=='伯爵夫人'){
					this.cards.splice(i,1);
				}
				i++;
			}*/
			socket.emit("playCard",{"playCardName":"伯爵夫人"});
		},
		discardPrincess(){
			socket.emit("playCard",{"playCardName":"公主"});
		}
	},
	computed: {
		roomPlayers(){
			let roomPlayers = {};
			let playerNum = Object.keys(this.players).length;
			var cnt = 3; //2人
			if(playerNum >= 3){
				cnt = 2;
			}
			var findMyCard = false;
			var unsetPosition = [];
			for([userID, userData] of Object.entries(this.players)){
				roomPlayers[userID] = {playerName:userData['userName'],position:'',mycard:false,playing:false,out:false,winner:false};
				if(this.userID==userID){
					findMyCard = true;
					roomPlayers[userID]['playerName']+='(我)';
					roomPlayers[userID]['position']='player1';
					roomPlayers[userID]['mycard']=true;
				}else if(findMyCard){
					roomPlayers[userID]['position']='player'+cnt;
					if(playerNum == 3){
						cnt++;
					}
					cnt++;
				}else{
					unsetPosition.push(userID);
				}

				if(this.winner==userID){
					roomPlayers[userID]['playerName']+='(勝利ＹＹ)';
					roomPlayers[userID]['winner']=true;
				}else if(userData['out']){
					roomPlayers[userID]['playerName']+='(出局)';
					roomPlayers[userID]['out']=true;
				}else if(userData['playing']){
					roomPlayers[userID]['playerName']+='(出牌中)';
					roomPlayers[userID]['playing']=true;
				}
			}
			for(userID of unsetPosition){
				roomPlayers[userID]['position']='player'+cnt;
				if(playerNum == 3){
					cnt++;
				}
				cnt++;
			}
			return roomPlayers;
		},
		choosePlayer(){
			let choosePlayer = {};
			for([userID, userData] of Object.entries(this.players)){
				if(!userData['out'] && !userData['playing']){
					choosePlayer[userID]=userData['userName'];
					this.guessPlayerID = userID
				}
			}
			return choosePlayer;
		},
		forceShowCountess(){
			//當持有伯爵夫人時，又抽到國王或是王子，就必須棄掉伯爵夫人這張牌
			if((this.cards[0]=='伯爵夫人' && (this.cards[1]=='國王' || this.cards[1]=='王子')) ||
				(this.cards[1]=='伯爵夫人' && (this.cards[0]=='國王' || this.cards[0]=='王子'))){
				this.currentplay=false;    //不可chooseCard()
				this.showPlayResult=false; //hide playResult msg
				this.maidProtect=false;    //hide 侍女保護msg
				return true;
			}else{
				return false;
			}
		}
	}
});

socket.on('Waiting', function(m) {
	data.showEnter=false;
	data.showWaiting=true;

	data.roomName = m.roomName;
	data.roomUsers = m.rs;
});
socket.on('getCards', function(d) {
	data.showWaiting=false;
	data.showGameTable=true;

	data.showPlayResult=false;
	data.msg='';
	data.h1='遊戲繼續';
	data.winner=false;
	data.showGuard=false;
	data.showPriest=false;
	data.showLord=false;
	data.showMaid=false;
	data.maidProtect=false;
	data.showPrince=false;
	data.showKing=false;
	data.showPrincess=false;

	data.userID = socket.id;
	data.cardsNum = d.cardsNum;

	const players = d.players;
	data.players = players;
	data.currentplay = players[data.userID].playing;

	const userCards = d.userCards;
	data.cards = userCards[data.userID].cards;
});
socket.on('playResult', function(d) {
	data.cardsNum = d.cardsNum;

	const players = d.players;
	data.players = d.players;
	data.currentplay = players[data.userID].playing;

	const userCards = d.userCards;
	data.cards = userCards[data.userID].cards;
	data.maidProtect = userCards[data.userID].maidProtect;
	data.showMaid=false;

	if(d.winner){
		data.currentplay=false;
		data.winner=d.winner;
		data.h1='遊戲結束。' //+data.roomUsers[d.winner]+'獲得一枚好感指示物';
	}

	data.msg += d.msg[data.userID]+"<br>";
	data.msg2 = d.msg[data.userID];
	data.playerCardName = d.playCardName;
	data.showPlayResult=true;
	data.showGuard=false;
	data.showPriest=false;
	data.showLord=false;
	data.showPrince=false;
	data.showKing=false;
	data.showCountess=false;
	data.showPrincess=false;

});

window.onload=function(){
	if(document.documentElement.scrollHeight <= document.documentElement.clientHeight) {
		bodyTag = document.getElementsByTagName('body')[0];
		bodyTag.style.height = document.documentElement.clientWidth / screen.width * screen.height + 'px';
	}
	setTimeout(function() {
		window.scrollTo(0, 1);
	}, 0);
};