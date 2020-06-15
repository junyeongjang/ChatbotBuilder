const express = require("express");
const bodyParser = require("body-parser");
const passport = require("passport"); // passport 패키지 설치
const port = process.env.PORT || 5000; //5000포트 사용 react는 3000포트 proxy로 연결중
const flash = require("connect-flash"); //일회용 메세지를 출력하는 미들웨어
const session = require("express-session"); //세선관리용 미들웨어
const AWS = require('aws-sdk'); //asw sdk
require('dotenv').config(); //dotenv 사용
//line 
const line = require('@line/bot-sdk');//라인봇 
const middleware = require('@line/bot-sdk').middleware
const JSONParseError = require('@line/bot-sdk').JSONParseError
const SignatureValidationFailed = require('@line/bot-sdk').SignatureValidationFailed
const Client = require('@line/bot-sdk').Client;
// 
//line DB
const ChatbotData = require('./models').ChatbotData;
const User = require('./models').User; 

//token 
const config = {
    channelAccessToken: process.env.LINE_ACCESS_TOKEN,
    channelSecret: process.env.LINE_SECRET_CODE,
};
const client = new line.Client(config);

//aws sdk 연결 
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_ID,
  region : 'ap-northeast-2'
});

const cookieParser = require("cookie-parser");
const sequelize = require("./models").sequelize;
const passportConfig = require("./passport"); // passport 모듈 연결

const app = express();
sequelize.sync();
passportConfig(passport); //passport

//
app.post('/webhook', line.middleware(config), (req, res) => {
    if (req.body.destination) {
      console.log("Destination User ID: " + req.body.destination);
     }
    // req.body.events should be an array of events
    if (!Array.isArray(req.body.events)) {
      return res.status(500).end();
    }
    // handle events separately
    Promise.all(req.body.events.map(handleEvent))
      .then(() => res.end())
      .catch((err) => {
        console.error(err);
        res.status(500).end();
    });
});
  

// callback function to handle a single event
function handleEvent(event) {
    switch (event.type) {
     case 'message':
       const message = event.message;
         if(message.type==='text')
           return handleText(message, event.replyToken, event.source);
    }
}
   
function logic(array,text){   //키워드 찾는 함수 
    let contents= [];
    let flag = 0;
    array.forEach(element => {
        if(element.keyword===text) {
            console.log("키워드 찾음", element.keyword);
            contents = element.contents;
            flag=1;
        }
    });
        if(flag==1) return contents;
        else return 0;
}
async function handleText(message, replyToken, source) {
    const data = await ChatbotData.findAll({
     attributes:['data'],
    });
    const data1 = await JSON.parse(data[0].data);
    const contents = await logic(data1,message.text);
    if(contents){
     const msg_array =[];
     contents.forEach(element=> {
        const type_val = element.type;
        const text_val = element.content;
        //위치 정보
        const title_val = element.title;
        const latitude_val = Number(element.latitude);  //정확한 위도 정보가 아니면 error
        const longitude_val = Number(element.longtitude); //정확한 경도 정보가 아니면 error
        //이미지 정보 
        const url_val = element.filepath;
        if(type_val==='text'){
           console.log("텍스트 타입 통과");
           msg_array.push({type: type_val, text: text_val});
           console.log(msg_array);
        }
        else if(element.type==='location'){
            console.log("위치 타입 통과");
            console.log(element);
            msg_array.push({type: type_val, title: title_val, address: "adress", latitude: latitude_val, longitude: longitude_val});
        } 
       else if(type_val==='image'){
        console.log("이미지 타입 통과");
       // console.log(element);
	msg_array.push({type: "image", originalContentUrl: url_val, previewImageUrl: url_val });
        //originalContentUrl =>필수 정보
        //previewImageUrl => 필수 정보
       }
       else if(type_val==='video'){
        console.log("비디오 타입 통과");
	console.log(element);
	const v_url = element.filepath;
        msg_array.push({type: "video", originalContentUrl: v_url, previewImageUrl: v_url });
        //originalContentUrl => 필수 정보
        //previewImageUrl => 필수 정보 
       }
       else if(type_val==='audio'){
        console.log("오디오 타입 통과");
	// console.log(element.filepath);
        msg_array.push({type: "audio", originalContentUrl:url_val, duration:3000});
        //originalContentUrl => 필수 정보
        //duration => 필수 정보 => Length of audio file (milliseconds)
       }
});
    return client.replyMessage(replyToken, msg_array)
        .then(() => {
        console.log("출력통과");
        })
        .catch((err) => {
        console.log(err);
    });
 }
}


//라우터 연결

const chatbotDataRouter = require("./routes/chatbotData"); //챗봇 생성 라우터
const imageRouter = require("./routes/image"); //이미지 라우터
const videoRouter = require("./routes/video"); //비디오 라우터
const audioRouter = require("./routes/audio"); //오디오 라우터
const fileRouter = require("./routes/file"); //파일 라우터
const authRouter = require("./routes/auth"); //로그인 라우터


// 세션관리 + cookiparser 미들웨어
app.use(cookieParser("secret code"));
app.use(
  session({
    resave: false,
    saveUninitialized: false,
    secret: "secret code",
    cookie: {
      httpOnly: true,
      secure: false,
    },
    name: "Ez.ai",
  })
);

//미들웨어 사용
app.use("/", express.static("objects"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(flash()); // flash 미들웨어
app.use(passport.initialize()); //passport 사용
app.use(passport.session()); //passport 사용

//라우터 사용

app.use("/api/chatbotdata", chatbotDataRouter); //챗봇 생성 라우터
app.use("/api/image", imageRouter); //이미지
app.use("/api/video", videoRouter); //비디오
app.use("/api/audio", audioRouter); //오디오
app.use("/api/file", fileRouter); //파일
app.use("/api/user", authRouter); //로그인
// 아직 에러 처리부분 없음
app.listen(port, () => console.log(`Listening on port ${port}`));