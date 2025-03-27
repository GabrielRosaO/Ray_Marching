const express = require('express');
const path = require('path');

const app = express();

// Servir arquivos estáticos da pasta atual
app.use(express.static(__dirname));

app.listen(3000, () => {
    console.log('Servidor rodando em http://localhost:3000');
});