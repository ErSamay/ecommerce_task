const mysql = require("mysql2");

const conn = mysql.createConnection({
    user : "root" , 
    host : "localhost",
    password: "samay",
    database : "item"
})

conn.connect((err) => {
    if(err) throw err;
    console.log("DB CONNECTED");
})
module.exports = conn;