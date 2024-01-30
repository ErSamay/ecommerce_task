const port = 4000;
const express = require("express");
const app = express();
const mysql = require("mysql2");
const cors = require("cors");
const multer = require("multer")
const bcrypt = require('bcrypt');
const jwt = require("jsonwebtoken");
const path = require("path");
const conn = require("./db/connection.js")
app.use(express.json());
app.use(cors());

app.get("/" , (req , res) => {
    res.send("HELLO EVERYONE");
})

const fs = require('fs');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = "./upload/images";

        
        if (!fs.existsSync(uploadPath)) {
            
            fs.mkdirSync(uploadPath, { recursive: true });
        }

        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        return cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`)
    }
});

const upload = multer({storage:storage});


app.use("/images",express.static('upload/images'));

app.post('/upload', upload.single('image'), (req, res) => {
    try {
        

        res.json({
            success: 1,
            image_url: `http://localhost:${port}/images/${req.file.filename}`
        });
    } catch (error) {
        console.error('Error during file upload:', error);
        res.status(500).json({
            success: 0,
            error: 'Internal Server Error'
        });
    }
});



app.post("/addproduct", async (req, res) => {
    const productsQuery = "SELECT * FROM products";
    
   
    conn.query(productsQuery, (err, products) => {
        if (err) {
            console.error("Error fetching products:", err);
            return res.status(500).json({ success: false, error: "Internal Server Error" });
        }

        
        const id = products.length > 0 ? products[products.length - 1].id + 1 : 1;

        const productData = {
            id: req.body.id,
            name: req.body.name,
            image: req.body.image,
            category: req.body.category,
            new_price: req.body.new_price,
            old_price: req.body.old_price,
            date: new Date(), 
            available: true, 
        };

        
        const insertQuery = "INSERT INTO products SET ?";
        conn.query(insertQuery, productData, (insertErr, result) => {
            if (insertErr) {
                console.error("Error inserting product:", insertErr);
                return res.status(500).json({ success: false, error: "Internal Server Error" });
            }

            console.log("Product inserted successfully");
            res.json({ success: true, name: req.body.name });
        });
    });
});
app.post("/removeproduct", async (req, res) => {
    const productId = req.body.id;

    const deleteQuery = "DELETE FROM products WHERE id = ?";
    
    conn.query(deleteQuery, [productId], (err, result) => {
        if (err) {
            console.error("Error removing product:", err);
            return res.status(500).json({ success: false, error: "Internal Server Error" });
        }
        console.log("Product removed successfully");
        res.json({ success: true, name: req.body.name });
    });
});

app.get("/allProducts", (req, res) => {
    const selectAllQuery = "SELECT * FROM products";

    conn.query(selectAllQuery, (err, result) => {
        if (err) {
            console.error("Error fetching all products:", err);
            return res.status(500).json({ success: false, error: "Internal Server Error" });
        }

        console.log("All Products Fetched");
        res.json(result);
    });
});


app.post('/signup', async (req, res) => {
    try {
        
        const [rows] = await conn.promise().query('SELECT * FROM Users WHERE email = ?', [req.body.email]);

        if (rows.length > 0) {
            return res.status(400).json({ success: false, errors: 'Existing user found with the same email address' });
        }

        
        const hashedPassword = await bcrypt.hash(req.body.password, 10);

        
        const cart = {};
        for (let i = 0; i < 300; i++) {
            cart[i] = 0;
        }

        const [result] = await conn
            .promise()
            .query('INSERT INTO Users (name, email, password, cartData) VALUES (?, ?, ?, ?)', [
                req.body.username,
                req.body.email,
                hashedPassword,
                JSON.stringify(cart),
            ]);

        const userId = result.insertId;

        
        const token = jwt.sign({ user: { id: userId } }, 'secret_ecom');

        res.json({ success: true, token });
    } catch (error) {
        console.error('Error during signup:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

app.post('/login', async (req, res) => {
    try {
        
        const [rows] = await conn.promise().query('SELECT * FROM Users WHERE email = ?', [req.body.email]);

        if (rows.length > 0) {
            const user = rows[0];

            
            const passCompare = await bcrypt.compare(req.body.password, user.password);

            if (passCompare) {
                const data = {
                    user: {
                        id: user.id,
                    },
                };
                const token = jwt.sign(data, 'secret_ecom');
                res.json({ success: true, token });
            } else {
                res.json({ success: false, errors: 'Wrong Password' });
            }
        } else {
            res.json({ success: false, errors: 'Wrong email id' });
        }
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});
app.get("/newCollections", async (req, res) => {
    try {
        const productsQuery = "SELECT * FROM products ORDER BY date DESC LIMIT 8";
        const [newCollection] = await conn.promise().query(productsQuery);

        console.log("New Collection Fetched");
        res.json(newCollection);
    } catch (error) {
        console.error("Error fetching new collection:", error);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
});

app.get("/popularinwomen", async (req, res) => {
    try {
        const productsQuery = "SELECT * FROM products WHERE category = 'women' ORDER BY date DESC LIMIT 4";
        conn.query(productsQuery, (err, result) => {
            if (err) {
                console.error("Error fetching popular products in women:", err);
                return res.status(500).json({ success: false, error: "Internal Server Error" });
            }

            console.log("Popular in women fetched");
            res.json(result);
        });
    } catch (error) {
        console.error("Error during popular products in women fetch:", error);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
});

const fetchUser = async (req, res, next) => {
    const token = req.header('auth-token');

    if (!token) {
        return res.status(401).send({ errors: "Please authenticate using a valid token" });
    }

    try {
        const data = jwt.verify(token, 'secret_ecom');

      
        const [rows] = await conn.promise().query('SELECT * FROM Users WHERE id = ?', [data.user.id]);

        if (rows.length > 0) {
            req.user = rows[0];
            next();
        } else {
            res.status(401).send({ errors: "User not found" });
        }
    } catch (error) {
        res.status(401).send({ errors: "Please authenticate using a valid token" });
    }
};

app.post("/addtocart", fetchUser, async (req, res) => {
    try {
        const [userDataRows] = await conn.promise().query('SELECT cartData, version FROM Users WHERE id = ?', [req.user.id]);

        if (userDataRows.length > 0) {
            const userData = userDataRows[0];

            console.log('Fetched cartData:', userData.cartData, 'Version:', userData.version);

            let cartData;

            try {
                const cartDataString = typeof userData.cartData === 'string' ? userData.cartData : JSON.stringify(userData.cartData);
                cartData = JSON.parse(cartDataString || '{}');
            } catch (error) {
                console.error('Error parsing cartData:', error);
                cartData = {};
            }

            const itemId = req.body.itemid.toString();
            cartData[itemId] = (cartData[itemId] || 0) + 1;

            console.log('Updated cartData:', cartData);

            const updatedCartData = JSON.stringify(cartData);
            const updatedVersion = userData.version + 1;

            await conn.promise().beginTransaction();

            try {
                console.log('Before updating database:', updatedCartData, updatedVersion);

                await conn.promise().query('UPDATE Users SET cartData = ?, version = ? WHERE id = ?', [updatedCartData, updatedVersion, req.user.id]);

                console.log('After updating database');

                await conn.promise().commit();

                console.log('After committing transaction');

                res.send("ADDED");
            } catch (error) {
                await conn.promise().rollback();
                console.error('Error updating cartData in the database:', error);
                res.status(500).json({ success: false, error: 'Internal Server Error' });
            }
        } else {
            res.status(404).send({ errors: "User not found" });
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});
app.post("/removefromcart", fetchUser, async (req, res) => {
    try {
        const itemId = req.body.itemId && req.body.itemId.toString();

        if (!itemId) {
            return res.status(400).send({ errors: "Invalid item ID" });
        }

        await conn.promise().beginTransaction();

        try {
            const [userDataRows] = await conn.promise().query('SELECT id, version FROM Users WHERE id = ?', [req.user.id]);

            if (userDataRows.length > 0) {
                const userId = userDataRows[0].id;
                const userVersion = userDataRows[0].version;
                const updatedVersion = userVersion + 1;

                const [cartItemRows] = await conn.promise().query('SELECT quantity FROM cartItem WHERE user_id = ? AND item_id = ?', [userId, itemId]);

                if (cartItemRows.length > 0 && cartItemRows[0].quantity > 0) {
                    await conn.promise().query('UPDATE cartItem SET quantity = quantity - 1 WHERE user_id = ? AND item_id = ?', [userId, itemId]);

                    await conn.promise().query('UPDATE Users SET version = ? WHERE id = ? AND version = ?', [updatedVersion, userId, userVersion]);

                    await conn.promise().commit();

                    res.send("Removed");
                } else {
                    res.status(404).send({ errors: "Item not found in the cart or quantity is already zero" });
                }
            } else {
                res.status(404).send({ errors: "User not found" });
            }
        } catch (error) {
            await conn.promise().rollback();
            console.error('Error updating cartData in the database:', error);
            res.status(500).json({ success: false, error: 'Internal Server Error' });
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

app.post("/getcart", fetchUser, async (req, res) => {
    try {
        const [userDataRows] = await conn.promise().query('SELECT cartData FROM Users WHERE id = ?', [req.user.id]);

        if (userDataRows.length > 0) {
            const cartData = JSON.parse(userDataRows[0].cartData);
            res.json(cartData);
        } else {
            res.status(404).json({ errors: "User not found" });
        }
    } catch (error) {
        console.error('Error fetching user cart data:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});





app.listen(port , (error) => {
    if(!error){
        console.log("Server is running on port" + port)
    }
    else{
        console.log("Error:" + error);
    }
    
})