require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 5000;
app.get('/', (req, res) => res.send('ok'));
const server = app.listen(PORT, () => {
    console.log('Test Server listening on', PORT);
});
server.on('error', (err) => console.error('SERVER ERROR:', err));
setTimeout(() => console.log('Timeout finished'), 2000);
