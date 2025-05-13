require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const port = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || 'supersecretkey';

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'ProductDB'
};

let db;

async function connectToDatabase() {
    try {
        db = await mysql.createPool(dbConfig);
        console.log('Connected to MySQL database!');
    } catch (error) {
        console.error('Error connecting to database:', error);
        process.exit(1);
    }
}

app.use(express.json());

// Dummy user
const user = {
    username: 'admin',
    password: bcrypt.hashSync('password123', 8)
};

// Login route
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username !== user.username || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });
    res.json({ token });
});

// JWT verification middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(403);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// Apply JWT middleware to all /products routes
app.use('/products', authenticateToken);

// Get all products
app.get('/products', async (_req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM products');
        res.json(rows);
    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// Get a product by ID
app.get('/products/:id', async (req, res) => {
    const productId = req.params.id;
    try {
        const [rows] = await db.execute('SELECT * FROM products WHERE id = ?', [productId]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error("Error fetching product:", error);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});

// Add a new product with duplicate check
app.post('/products', async (req, res) => {
    const { name, price, description } = req.body;
    try {
        const [existing] = await db.execute('SELECT * FROM products WHERE name = ?', [name]);
        if (existing.length > 0) {
            return res.status(409).json({ error: 'Product already exists' });
        }
        const [result] = await db.execute('INSERT INTO products (name, price, description) VALUES (?, ?, ?)', [name, price, description]);
        res.status(201).json({ message: 'Product created', id: result.insertId });
    } catch (error) {
        console.error("Error creating product:", error);
        res.status(500).json({ error: 'Failed to create product' });
    }
});

// Update an existing product
app.put('/products/:id', async (req, res) => {
    const productId = req.params.id;
    const { name, price, description } = req.body;

    try {
        const [existing] = await db.execute('SELECT * FROM products WHERE id = ?', [productId]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        await db.execute(
            'UPDATE products SET name = ?, price = ?, description = ? WHERE id = ?',
            [name, price, description, productId]
        );

        res.json({ message: 'Product updated successfully' });
    } catch (error) {
        console.error("Error updating product:", error);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// Delete a product by ID
app.delete('/products/:id', async (req, res) => {
    const productId = req.params.id;
    try {
        const [existing] = await db.execute('SELECT * FROM products WHERE id = ?', [productId]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Product does not exist' });
        }

        await db.execute('DELETE FROM products WHERE id = ?', [productId]);
        res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error("Error deleting product:", error);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

async function startServer() {
    await connectToDatabase();
    app.listen(port, () => {
        console.log(`Server is listening on port ${port}`);
    });
}

startServer();

