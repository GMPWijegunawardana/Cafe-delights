import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import './App.css';

// Context for authentication and cart
const AuthContext = createContext();
const CartContext = createContext();

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Custom hooks
const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

// Auth Provider
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchProfile();
    }
  }, [token]);

  const fetchProfile = async () => {
    try {
      const response = await axios.get(`${API}/profile`);
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      logout();
    }
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API}/login`, { email, password });
      const { token, user } = response.data;
      setToken(token);
      setUser(user);
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Login failed' };
    }
  };

  const register = async (userData) => {
    try {
      const response = await axios.post(`${API}/register`, userData);
      const { token, user } = response.data;
      setToken(token);
      setUser(user);
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Registration failed' };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Cart Provider
const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);

  const addToCart = (product, quantity = 1) => {
    setCartItems(prev => {
      const existingItem = prev.find(item => item.id === product.id);
      if (existingItem) {
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { ...product, quantity }];
    });
  };

  const removeFromCart = (productId) => {
    setCartItems(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCartItems(prev =>
      prev.map(item =>
        item.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const getTotalPrice = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getItemCount = () => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  };

  return (
    <CartContext.Provider value={{
      cartItems,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      getTotalPrice,
      getItemCount
    }}>
      {children}
    </CartContext.Provider>
  );
};

// Navigation Component
const Navigation = () => {
  const { user, logout } = useAuth();
  const { getItemCount } = useCart();
  const [currentPage, setCurrentPage] = useState('home');

  return (
    <nav className="navbar">
      <div className="nav-container">
        <div className="nav-brand" onClick={() => setCurrentPage('home')}>
          <span className="brand-icon">☕</span>
          <span className="brand-text">Café Delights</span>
        </div>
        
        <div className="nav-links">
          <button 
            className={`nav-link ${currentPage === 'home' ? 'active' : ''}`}
            onClick={() => setCurrentPage('home')}
          >
            Home
          </button>
          <button 
            className={`nav-link ${currentPage === 'menu' ? 'active' : ''}`}
            onClick={() => setCurrentPage('menu')}
          >
            Menu
          </button>
          {user && (
            <button 
              className={`nav-link ${currentPage === 'orders' ? 'active' : ''}`}
              onClick={() => setCurrentPage('orders')}
            >
              My Orders
            </button>
          )}
          {user?.role === 'admin' && (
            <button 
              className={`nav-link ${currentPage === 'admin' ? 'active' : ''}`}
              onClick={() => setCurrentPage('admin')}
            >
              Admin
            </button>
          )}
        </div>
        
        <div className="nav-actions">
          <button 
            className="cart-button"
            onClick={() => setCurrentPage('cart')}
          >
            🛒 Cart ({getItemCount()})
          </button>
          {user ? (
            <div className="user-menu">
              <span className="user-name">Hello, {user.name}</span>
              <button className="logout-btn" onClick={logout}>Logout</button>
            </div>
          ) : (
            <button 
              className="login-btn"
              onClick={() => setCurrentPage('auth')}
            >
              Login
            </button>
          )}
        </div>
      </div>
      
      <PageRouter currentPage={currentPage} setCurrentPage={setCurrentPage} />
    </nav>
  );
};

// Page Router Component
const PageRouter = ({ currentPage, setCurrentPage }) => {
  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage setCurrentPage={setCurrentPage} />;
      case 'menu':
        return <MenuPage setCurrentPage={setCurrentPage} />;
      case 'cart':
        return <CartPage setCurrentPage={setCurrentPage} />;
      case 'auth':
        return <AuthPage setCurrentPage={setCurrentPage} />;
      case 'orders':
        return <OrdersPage />;
      case 'admin':
        return <AdminPage />;
      default:
        return <HomePage setCurrentPage={setCurrentPage} />;
    }
  };

  return <div className="page-content">{renderPage()}</div>;
};

// Home Page Component
const HomePage = ({ setCurrentPage }) => {
  const [featuredProducts, setFeaturedProducts] = useState([]);

  useEffect(() => {
    fetchFeaturedProducts();
  }, []);

  const fetchFeaturedProducts = async () => {
    try {
      const response = await axios.get(`${API}/products?category=coffee`);
      setFeaturedProducts(response.data.slice(0, 3));
    } catch (error) {
      console.error('Failed to fetch featured products:', error);
    }
  };

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">Welcome to Café Delights</h1>
          <p className="hero-subtitle">
            Discover the perfect blend of flavor and comfort with our premium coffee, 
            fresh pastries, and delicious sandwiches.
          </p>
          <button 
            className="cta-button"
            onClick={() => setCurrentPage('menu')}
          >
            Explore Our Menu
          </button>
        </div>
        <div className="hero-image">
          <img 
            src="https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&h=400&fit=crop" 
            alt="Cozy café interior" 
          />
        </div>
      </section>

      {/* Featured Products */}
      <section className="featured-section">
        <h2 className="section-title">Featured Coffees</h2>
        <div className="featured-grid">
          {featuredProducts.map(product => (
            <div key={product.id} className="featured-card">
              <img src={product.image_url} alt={product.name} />
              <h3>{product.name}</h3>
              <p>{product.description}</p>
              <span className="price">${product.price.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* About Section */}
      <section className="about-section">
        <div className="about-content">
          <h2>Our Story</h2>
          <p>
            At Café Delights, we believe in creating moments of joy through exceptional 
            coffee and food. Every cup is crafted with passion, every pastry baked with 
            love, and every customer served with genuine care.
          </p>
        </div>
      </section>
    </div>
  );
};

// Menu Page Component
const MenuPage = ({ setCurrentPage }) => {
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const { addToCart } = useCart();

  const categories = [
    { value: '', label: 'All Items' },
    { value: 'coffee', label: 'Coffee' },
    { value: 'tea', label: 'Tea' },
    { value: 'pastry', label: 'Pastries' },
    { value: 'sandwich', label: 'Sandwiches' },
    { value: 'cake', label: 'Cakes' },
    { value: 'cookie', label: 'Cookies' },
  ];

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory]);

  const fetchProducts = async () => {
    try {
      const url = selectedCategory 
        ? `${API}/products?category=${selectedCategory}`
        : `${API}/products`;
      const response = await axios.get(url);
      setProducts(response.data);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      fetchProducts();
      return;
    }
    
    try {
      const response = await axios.get(`${API}/search/products?q=${searchTerm}`);
      setProducts(response.data);
    } catch (error) {
      console.error('Failed to search products:', error);
    }
  };

  const handleAddToCart = (product) => {
    addToCart(product);
    // Simple toast notification
    alert(`${product.name} added to cart!`);
  };

  return (
    <div className="menu-page">
      <div className="menu-header">
        <h1>Our Menu</h1>
        <div className="menu-controls">
          <div className="search-bar">
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button onClick={handleSearch}>Search</button>
          </div>
          
          <div className="category-filter">
            {categories.map(category => (
              <button
                key={category.value}
                className={`category-btn ${selectedCategory === category.value ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category.value)}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="products-grid">
        {products.map(product => (
          <div key={product.id} className="product-card">
            <img src={product.image_url} alt={product.name} />
            <div className="product-info">
              <h3>{product.name}</h3>
              <p>{product.description}</p>
              <div className="product-meta">
                <span className="price">${product.price.toFixed(2)}</span>
                <span className="category">{product.category}</span>
              </div>
              <button 
                className="add-to-cart-btn"
                onClick={() => handleAddToCart(product)}
              >
                Add to Cart
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Cart Page Component
const CartPage = ({ setCurrentPage }) => {
  const { cartItems, updateQuantity, removeFromCart, getTotalPrice, clearCart } = useCart();
  const { user } = useAuth();

  const handleCheckout = async () => {
    if (!user) {
      alert('Please login to place an order');
      setCurrentPage('auth');
      return;
    }

    if (cartItems.length === 0) {
      alert('Your cart is empty');
      return;
    }

    try {
      const orderItems = cartItems.map(item => ({
        product_id: item.id,
        quantity: item.quantity,
        price: item.price,
        product_name: item.name
      }));

      await axios.post(`${API}/orders`, {
        items: orderItems,
        delivery_address: user.address || "Pickup at store"
      });

      alert('Order placed successfully!');
      clearCart();
      setCurrentPage('orders');
    } catch (error) {
      console.error('Failed to place order:', error);
      alert('Failed to place order. Please try again.');
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className="cart-page">
        <div className="empty-cart">
          <h2>Your cart is empty</h2>
          <p>Add some delicious items from our menu!</p>
          <button 
            className="continue-shopping-btn"
            onClick={() => setCurrentPage('menu')}
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <h1>Shopping Cart</h1>
      
      <div className="cart-items">
        {cartItems.map(item => (
          <div key={item.id} className="cart-item">
            <img src={item.image_url} alt={item.name} />
            <div className="item-details">
              <h3>{item.name}</h3>
              <p>${item.price.toFixed(2)} each</p>
            </div>
            <div className="quantity-controls">
              <button onClick={() => updateQuantity(item.id, item.quantity - 1)}>-</button>
              <span>{item.quantity}</span>
              <button onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
            </div>
            <div className="item-total">
              ${(item.price * item.quantity).toFixed(2)}
            </div>
            <button 
              className="remove-btn"
              onClick={() => removeFromCart(item.id)}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="cart-summary">
        <div className="total">
          <strong>Total: ${getTotalPrice().toFixed(2)}</strong>
        </div>
        <div className="cart-actions">
          <button className="clear-cart-btn" onClick={clearCart}>
            Clear Cart
          </button>
          <button className="checkout-btn" onClick={handleCheckout}>
            Checkout
          </button>
        </div>
      </div>
    </div>
  );
};

// Auth Page Component
const AuthPage = ({ setCurrentPage }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    address: ''
  });
  const [error, setError] = useState('');
  const { login, register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const result = isLogin 
      ? await login(formData.email, formData.password)
      : await register(formData);

    if (result.success) {
      setCurrentPage('home');
    } else {
      setError(result.error);
    }
  };

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <h2>{isLogin ? 'Login' : 'Register'}</h2>
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <input
              type="text"
              name="name"
              placeholder="Full Name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          )}
          
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            required
          />
          
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
          />
          
          {!isLogin && (
            <>
              <input
                type="tel"
                name="phone"
                placeholder="Phone Number"
                value={formData.phone}
                onChange={handleChange}
              />
              <input
                type="text"
                name="address"
                placeholder="Address"
                value={formData.address}
                onChange={handleChange}
              />
            </>
          )}
          
          <button type="submit" className="auth-submit-btn">
            {isLogin ? 'Login' : 'Register'}
          </button>
        </form>
        
        <p className="auth-switch">
          {isLogin ? "Don't have an account?" : "Already have an account?"}
          <button 
            type="button"
            className="switch-btn"
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? 'Register' : 'Login'}
          </button>
        </p>
      </div>
    </div>
  );
};

// Orders Page Component
const OrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user]);

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API}/orders`);
      setOrders(response.data);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: '#f59e0b',
      confirmed: '#3b82f6',
      preparing: '#f97316',
      ready: '#10b981',
      completed: '#059669',
      cancelled: '#ef4444'
    };
    return colors[status] || '#6b7280';
  };

  if (!user) {
    return (
      <div className="orders-page">
        <p>Please login to view your orders.</p>
      </div>
    );
  }

  return (
    <div className="orders-page">
      <h1>My Orders</h1>
      
      {orders.length === 0 ? (
        <div className="no-orders">
          <p>You haven't placed any orders yet.</p>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map(order => (
            <div key={order.id} className="order-card">
              <div className="order-header">
                <span className="order-id">Order #{order.id.slice(-8)}</span>
                <span 
                  className="order-status"
                  style={{ color: getStatusColor(order.status) }}
                >
                  {order.status.toUpperCase()}
                </span>
              </div>
              
              <div className="order-items">
                {order.items.map((item, index) => (
                  <div key={index} className="order-item">
                    <span>{item.product_name}</span>
                    <span>x{item.quantity}</span>
                    <span>${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              
              <div className="order-footer">
                <span className="order-total">Total: ${order.total_amount.toFixed(2)}</span>
                <span className="order-date">
                  {new Date(order.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Admin Page Component
const AdminPage = () => {
  const [stats, setStats] = useState({});
  const [orders, setOrders] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchStats();
      fetchOrders();
    }
  }, [user]);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API}/orders`);
      setOrders(response.data);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      await axios.put(`${API}/orders/${orderId}/status?status=${status}`);
      fetchOrders(); // Refresh orders
    } catch (error) {
      console.error('Failed to update order status:', error);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="admin-page">
        <p>Access denied. Admin privileges required.</p>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <h1>Admin Dashboard</h1>
      
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Products</h3>
          <p className="stat-number">{stats.total_products || 0}</p>
        </div>
        <div className="stat-card">
          <h3>Total Orders</h3>
          <p className="stat-number">{stats.total_orders || 0}</p>
        </div>
        <div className="stat-card">
          <h3>Total Users</h3>
          <p className="stat-number">{stats.total_users || 0}</p>
        </div>
        <div className="stat-card">
          <h3>Pending Orders</h3>
          <p className="stat-number">{stats.pending_orders || 0}</p>
        </div>
      </div>

      <div className="admin-orders">
        <h2>Recent Orders</h2>
        <div className="orders-table">
          {orders.map(order => (
            <div key={order.id} className="admin-order-card">
              <div className="order-info">
                <span>Order #{order.id.slice(-8)}</span>
                <span>${order.total_amount.toFixed(2)}</span>
                <span>{new Date(order.created_at).toLocaleDateString()}</span>
              </div>
              <div className="order-status-controls">
                <select
                  value={order.status}
                  onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="preparing">Preparing</option>
                  <option value="ready">Ready</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Main App Component
function App() {
  return (
    <div className="App">
      <AuthProvider>
        <CartProvider>
          <Navigation />
        </CartProvider>
      </AuthProvider>
    </div>
  );
}

export default App;