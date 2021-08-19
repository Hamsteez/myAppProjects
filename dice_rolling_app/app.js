const HTTP = require('http');
const PORT = 3000;
const URL = require('url').URL;

function diceRoll(sidesOfDie) {
  return Math.floor(Math.random() * sidesOfDie) + 1;
}

const SERVER = HTTP.createServer((req, res) => {
  let method = req.method;
  let path = req.url;
  const newURL = new URL(path, `http://http://localhost:${PORT}/`);
  let params = newURL.searchParams;
  let numberOfRolls = params.get('rolls');
  let sides = params.get('sides');  

  if (path === '/favicon.ico') {
    res.statusCode = 404;
    res.end();
  } else {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    for (let idx = 0; idx < numberOfRolls; idx++) {
      let diceNum = diceRoll(sides);
      res.write(`${diceNum}\n`);
    }
    res.write(`${method} ${path}\n`);
    res.end();
  }
});

SERVER.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});