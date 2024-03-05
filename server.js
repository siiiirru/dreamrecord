const express = require('express'); //서버
const mysql = require('mysql'); //database
const path = require('path'); //public 경로
const serveStatic = require('serve-static'); //server.js가 최상위
const app = express();
const porti = process.env.PORT || 3000
const dbconfig = require('./config/dbconfig.json');
app.set('view engine', 'ejs'); //ejs템플릿 엔진 설정


//서버
app.use(express.urlencoded({ extended: true })) //확장된 url인코딩도 받아들이겠다.
app.use(express.json())//웹이 데이터를 json형식으로 보내도 받겠다.
app.use('/public', serveStatic(path.join(__dirname, 'public'))); //__dirname은 현재디렉토리. public이 조상이 된다.

//데이터베이스 커넥션 풀
let pool = mysql.createPool({ //mysql과 nodejs가 연결할 수 있는 공유킥보드
  connectionLimit: 70,
  host: 'us-cdbr-east-06.cleardb.net',
  user: 'b45ffdf8f637c7',
  password: '***',
  database: 'heroku_25272ac47d4d79d',
  charset: 'utf8mb4',
  debug: false
});

//세션
const session = require('express-session');
app.use(session({
  secret: '***',
  resave: false,
  saveUninitialized: true
}));

//로그인 요청시
app.post('/process/login', (req, res) => {
  console.log('/process/login 호출됨' + req)
  const paramID = req.body.id; //req안에 body안에 id. 이 문법은 app.use(express.json()) 이것 때문에 가능함.
  const paramPW = req.body.password;
  console.log('로그인 요청' + paramID + ' ' + paramPW);
  pool.getConnection((err, conn) => {
    console.log("express와 데이터베이스 연결됨")
    const exec = conn.query('select `id`,`name` from `users` where `id`=? and `password`=?',
      [paramID, paramPW],
      (err, rows) => {
        conn.release();
        console.log('실행된 SQL query: ' + exec.sql);
        if (rows.length === 0) {
          console.log('SQL 실행 시 오류발생')
          console.dir(err);
          res.writeHead('200', { 'Content-Type': 'text/html; charset=utf8' });
          res.write('<script>');
          res.write('window.alert("로그인 실패. 해당 ID 혹은 PW를 찾을 수 없습니다.");');
          res.write('location.href = "/";');
          res.write('</script>');
          res.end();
          return
        }

        if (rows.length > 0) {
          console.log(`아이디${paramID},패스워드가 일치하는 항목 찾음`);
          req.session.user = {
            id: paramID,
            name: rows[0].name
          };
          res.writeHead('200', { 'Content-Type': 'text/html; charset=utf8' });
          res.write('<script>');
          res.write('window.alert("로그인 성공");');
          res.write('location.href = "/calendar";');
          res.write('</script>');
          res.end();
        }

      }
    )
  })
})

//회원가입 요청시
app.post('/process/sign_up', (req, res) => {
  console.log('/process/sign_up 호출됨' + req)
  const paramID = req.body.id; //req안에 body안에 id. 이 문법은 app.use(express.json()) 이것 때문에 가능함.
  const paramPW = req.body.password;
  const paramNM = req.body.name;
  pool.getConnection((err, conn) => {
    if (err) { 
      console.log('Mysql getconnetction error');
      res.writeHead('200', { 'Content-Type': 'text/html; charset=utf8' })
      res.write('<h2>DB서버 연결 실패</h2>')
      res.end();
      return;
    }
    console.log("express와 데이터베이스 연결됨")

    const exec = conn.query('INSERT INTO users (id, name, password) VALUES (?,?,?)', //얻어온 커넥션에 쿼리보내기. 패스워드는 암호화된 스트링으로 저장됨
      [paramID, paramNM, paramPW],
      (err, result) => {
        conn.release(); //커넥션을 pool에게 돌려줌
        console.log('실행된 SQL: ' + exec.sql) //서버로 보냈던 물음표가 모두 값으로 출력

        if (err) {
          console.log('SQL 실행 시 오류발생')
          console.dir(err);
          res.writeHead('200', { 'Content-Type': 'text/html; charset=utf8' })
          res.write('<h2>sql실행 실패</h2>')
          res.end();
          return
        }

        if (result) {
          console.dir(result)
          console.log('inserted 성공')

          res.writeHead('200', { 'Content-Type': 'text/html; charset=utf8' });
          res.write('<script>');
          res.write('window.alert("회원가입 성공");');
          res.write('window.location.href = "/public/dreamh.html";');  // 'dreamh.html'로 리다이렉트
          res.write('</script>');
          res.end();
        }
        else {
          console.log('inserted 실패')

          res.writeHead('200', { 'Content-Type': 'text/html; charset=utf8' })
          res.write('<h2>회원가입 실패</h2>')
          res.end();
        }
      })
  })
})

//홈
app.get('/', (req, res) => { res.redirect('/public/dreamh.html'); })


app.get('/calendar', (req, res) => {
  const userId = req.session.user ? req.session.user.id : null;
  const userName = req.session.user ? req.session.user.name : null;
  console.log(`캘린더로 보내진 아이디: ${userId}`);
  // dreamc.html 페이지 렌더링 및 사용자 정보 전달
  res.render('dreamca', { id: userId, name: userName });
})

//이미지 가져오기
app.post('/get-image', (req, res) => {
  console.log('/get-image 호출됨')
  const id = req.body.id; // 요청 본문에서 id 추출
  const date = req.body.dateString; // 요청 본문에서 date 추출
  // 데이터베이스에서 변수 값을 조회하여 TEXT 형식의 이미지 url을 가져오는 로직 수행

  pool.getConnection((err, conn) => {
    if (err) {
      console.log('Mysql getConnection error');
      return;
    }
    console.log("Express와 데이터베이스 연결됨");
    const query = conn.query(
      'SELECT `dimg` FROM `calendar` WHERE `date`=? AND `userid`=?',
      [date, id],
      (errr, result) => {
        conn.release();
        console.log('실행된 SQL: ' + query.sql);
        if (errr) {
          console.log('SQL 실행 시 오류 발생');
          res.end();
        }
        if (result.length > 0) {
          req.session.date = {
            udate: date
          };
          console.log({ result })
          const base64Image = result[0].dimg.toString('base64');
          const responseData = {
            image: base64Image
          };
          res.json(responseData);
        } else {
          console.log('이미지 없음');
          res.status(404).send('이미지 없음');
        }
      }
    );
  });
}
);


app.get('/dreamchat', (req, res) => {
  const userId = req.session.user ? req.session.user.id : null;
  const userName = req.session.user ? req.session.user.name : null;
  const userdate = req.session.date ? req.session.date.udate : null;
  res.render('dreamchat', { id: userId, name: userName, date: userdate });
});

//GPT API
const { Configuration, OpenAIApi } = require("openai");

const configuration = new Configuration({
  apiKey: '***',
});
const openai = new OpenAIApi(configuration);

//파파고API

const axios = require('axios');

// 채팅 읽어들이고 보내기
app.post('/chatsend', async (req, res) => {
  const userchat = req.body.usersend;
  console.log(`불러온 메세지: ${userchat}`);

  try {
    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "user", content: "하늘을 나는 꿈을 꿨어" },
        {
          role: "assistant",
          content:
            "일반적으로 \"하늘을 나는 꿈\"은 다음과 같은 의미를 갖을 수 있습니다.\n\n#자유와 해방: 하늘을 나는 꿈은 자유로움과 해방을 상징할 수 있습니다. 이는 어떠한 제약에서 벗어나 자유롭게 행동하고 표현하고 싶은 욕망을 나타낼 수 있습니다.\n# 창의성과 비전: 하늘을 나는 꿈은 창의성과 비전을 나타낼 수 있습니다. 하늘을 나는 것은 한계를 벗어나 새로운 아이디어나 관점을 발견하고 상상력을 표현하는 욕망을 상징할 수 있습니다.\n# 자기표현과 자신감: 하늘을 나는 꿈은 자기표현과 자신감을 상징할 수 있습니다. 자신의 능력과 자신감을 믿고 현재의 상황을 넘어서며 자유롭게 표현하고자 하는 욕망을 나타낼 수 있습니다.",
        },
        { role: "user", content: `${userchat}` },
      ],
    });

    const clientId = dbconfig.CLIENT_ID;
    const clientSecret = dbconfig.CLIENT_SECRET;
    const api_url = 'https://openapi.naver.com/v1/papago/n2mt';
    const papagoResponse = await axios.post(
      api_url,
      { source: 'ko', target: 'en', text: userchat },
      {
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret,
        },
      }
    );

    const response = await openai.createImage({
      prompt: `${papagoResponse.data.message.result.translatedText}`,
      n: 1,
      size: "512x512",
    });

    const chat = completion.data.choices[0].message;
    const aimg = response.data.data[0];
    console.log(chat);
    console.log(aimg);
    res.send({ chat, aimg });
  } catch (error) {
    console.error('오류:', error);
    res.status(500).send('서버 오류');
  }
});

//채팅 저장
app.post('/chatsave', (req, res) => {
  let dat = new Date(); //오늘변수 
  var dyear = dat.getFullYear();
  var dmonth = String(dat.getMonth() + 1).padStart(2, '0');
  var dday = String(dat.getDate()).padStart(2, '0');
  var ddateString = `${dyear}-${dmonth}-${dday}`; //저장서버로 보낼 오늘변수
  req.session.date = {
    udate: ddateString
  };
  console.log('/chatsave 호출됨' + req)
  const id = req.session.user ? req.session.user.id : null; //id
  const dq = req.body.usersend; //질문한 꿈
  const da = req.body.savecon; //해몽 글
  const di = req.body.saveimg; //꿈 이미지
  const day = req.session.date ? req.session.date.udate : null; //해당날짜
  pool.getConnection((err, conn) => {
    if (err) { //에러면
      console.log('Mysql getconnetction error');
      res.writeHead('200', { 'Content-Type': 'text/html; charset=utf8' })
      res.write('<h2>DB서버 연결 실패</h2>')
      res.end();
      return;
    }
    console.log("express와 데이터베이스 연결됨")

    //이미지 다운로드 및 blob변환
    axios.get(di, { responseType: 'arraybuffer' })
      .then(response => {
        const imageBuffer = Buffer.from(response.data, 'binary');

        const exec = conn.query('INSERT INTO calendar (date, dq, da, dimg, userid) VALUES (?,?,?,?,?)', //얻어온 커넥션에 쿼리보내기.
          [day, dq, da, imageBuffer, id],
          (err, result) => {
            conn.release(); //커넥션을 pool한테 돌려줌
            console.log('실행된 SQL: ' + exec.sql) //서버로 보냈던 물음표가 모두 값으로 출력

            if (err) {
              console.log('SQL 실행 시 오류발생')
              console.dir(err);
              res.writeHead('200', { 'Content-Type': 'text/html; charset=utf8' })
              res.write('<h2>sql실행 실패</h2>')
              res.end();
              return
            }

            if (result.length > 0) {
              console.dir(result)
              console.log('inserted 성공')
              res.redirect('/dreams'); // 'dreamh.html'로 리다이렉트
              res.end();
            }
            else {
              console.log('inserted 실패')
              res.writeHead('200', { 'Content-Type': 'text/html; charset=utf8' })
              res.write('<h2>꿈 저장 실패</h2>')
              res.end();
            }
          })
      })
  })
})

//저장된 꿈 출력페이지
app.get('/dreams/:date', (req, res) => {
  console.log("/dreams 호출됨")
  const userId = req.session.user ? req.session.user.id : null;
  const userName = req.session.user ? req.session.user.name : null;
  const userdate = req.params.date;
  console.log(req.query.date);
  let sdq; let sda; let simg;
  pool.getConnection((err, conn) => {
    if (err) {
      conn.release();
      console.log('Mysql getconnetction error');
      return;
    }
    console.log("express와 데이터베이스 연결됨")
    const exec = conn.query('select `dq`,`da`,`dimg` from `calendar` where `userid`=? and `date`=?',
      [userId, userdate],
      (err, rows) => {
        conn.release();
        console.log('실행된 SQL query: ' + exec.sql);
        if (err) {
          console.log('SQL 실행 시 오류발생')
          console.dir(err);
          res.writeHead('200', { 'Content-Type': 'text/html; charset=utf8' })
          res.write('<h2>sql실행 실패</h2>')
          res.end();
          return
        }

        if (rows[0].dq.length > 0) {
          console.log(`검색한 꿈 항목 찾음`);
          sdq = rows[0].dq;
          sda = rows[0].da;
          simg = rows[0].dimg.toString('base64');
        }
        sendResponse();
      }
    )
    function sendResponse() {
      res.render('dreams', { id: userId, name: userName, date: userdate, sdq: sdq, sda: sda, sdi: simg });
    }
  })
});


app.listen(porti, () => {
  console.log(`listening ${porti}port`)
});