from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import hashlib
import jwt
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(title="Café Delights API", description="A comprehensive bakery shop API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()
SECRET_KEY = "your-secret-key-change-in-production"

# Enums
class ProductCategory(str, Enum):
    COFFEE = "coffee"
    TEA = "tea"
    PASTRY = "pastry"
    SANDWICH = "sandwich"
    CAKE = "cake" 
    COOKIE = "cookie"
    BEVERAGE = "beverage"

class OrderStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PREPARING = "preparing"
    READY = "ready"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class UserRole(str, Enum):
    CUSTOMER = "customer"
    ADMIN = "admin"

# Models
class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    price: float
    category: ProductCategory
    image_url: str
    available: bool = True
    ingredients: List[str] = []
    nutritional_info: Dict[str, Any] = {}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductCreate(BaseModel):
    name: str
    description: str
    price: float
    category: ProductCategory
    image_url: str
    ingredients: List[str] = []
    nutritional_info: Dict[str, Any] = {}

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    role: UserRole = UserRole.CUSTOMER
    phone: Optional[str] = None
    address: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str
    phone: Optional[str] = None
    address: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class OrderItem(BaseModel):
    product_id: str
    quantity: int
    price: float
    product_name: str

class Order(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    items: List[OrderItem]
    total_amount: float
    status: OrderStatus = OrderStatus.PENDING
    payment_method: str = "card"
    delivery_address: Optional[str] = None
    special_instructions: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OrderCreate(BaseModel):
    items: List[OrderItem]
    delivery_address: Optional[str] = None
    special_instructions: Optional[str] = None

class Review(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: str
    user_id: str
    user_name: str
    rating: int = Field(..., ge=1, le=5)
    comment: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReviewCreate(BaseModel):
    product_id: str
    rating: int = Field(..., ge=1, le=5)
    comment: str

# Utility functions
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc).timestamp() + 86400  # 24 hours
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"id": user_id})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return User(**user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Initialize sample data
async def init_sample_data():
    # Check if products already exist
    existing_products = await db.products.count_documents({})
    if existing_products > 0:
        return
    
    sample_products = [
        # Coffee
        {
            "id": str(uuid.uuid4()),
            "name": "Espresso",
            "description": "Rich and bold espresso shot made from premium coffee beans",
            "price": 2.50,
            "category": "coffee",
            "image_url": "https://images.unsplash.com/photo-1541167760496-1628856ab772?w=400&h=300&fit=crop",
            "available": True,
            "ingredients": ["coffee beans", "water"],
            "nutritional_info": {"calories": 5, "caffeine_mg": 63},
            "created_at": datetime.now(timezone.utc)
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Cappuccino",
            "description": "Perfect balance of espresso, steamed milk, and foam",
            "price": 4.25,
            "category": "coffee",
            "image_url": "https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&h=300&fit=crop",
            "available": True,
            "ingredients": ["coffee beans", "milk", "milk foam"],
            "nutritional_info": {"calories": 120, "caffeine_mg": 63},
            "created_at": datetime.now(timezone.utc)
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Latte",
            "description": "Smooth espresso with steamed milk and light foam",
            "price": 4.50,
            "category": "coffee",
            "image_url": "https://images.unsplash.com/photo-1561882468-9110e03e0f78?w=400&h=300&fit=crop",
            "available": True,
            "ingredients": ["coffee beans", "steamed milk"],
            "nutritional_info": {"calories": 150, "caffeine_mg": 63},
            "created_at": datetime.now(timezone.utc)
        },
        # Pastries
        {
            "id": str(uuid.uuid4()),
            "name": "Croissant",
            "description": "Buttery, flaky French pastry perfect for breakfast",
            "price": 3.50,
            "category": "pastry",
            "image_url": "https://images.unsplash.com/photo-1555507036-ab794f27da6a?w=400&h=300&fit=crop",
            "available": True,
            "ingredients": ["flour", "butter", "yeast", "milk", "eggs"],
            "nutritional_info": {"calories": 231, "fat_g": 12},
            "created_at": datetime.now(timezone.utc)
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Blueberry Muffin",
            "description": "Fresh baked muffin loaded with juicy blueberries",
            "price": 3.25,
            "category": "pastry",
            "image_url": "https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=400&h=300&fit=crop",
            "available": True,
            "ingredients": ["flour", "blueberries", "sugar", "eggs", "butter"],
            "nutritional_info": {"calories": 265, "sugar_g": 18},
            "created_at": datetime.now(timezone.utc)
        },
        # Sandwiches
        {
            "id": str(uuid.uuid4()),
            "name": "Club Sandwich",
            "description": "Triple-decker with turkey, bacon, lettuce, and tomato",
            "price": 8.75,
            "category": "sandwich",
            "image_url": "https://images.unsplash.com/photo-1567234669003-dce7a7a88821?w=400&h=300&fit=crop",
            "available": True,
            "ingredients": ["bread", "turkey", "bacon", "lettuce", "tomato", "mayo"],
            "nutritional_info": {"calories": 450, "protein_g": 28},
            "created_at": datetime.now(timezone.utc)
        },
        # Cakes
        {
            "id": str(uuid.uuid4()),
            "name": "Chocolate Cake",
            "description": "Rich, moist chocolate cake with chocolate frosting",
            "price": 5.50,
            "category": "cake",
            "image_url": "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop",
            "available": True,
            "ingredients": ["flour", "cocoa", "sugar", "eggs", "butter", "chocolate"],
            "nutritional_info": {"calories": 365, "sugar_g": 35},
            "created_at": datetime.now(timezone.utc)
        }
    ]
    
    await db.products.insert_many(sample_products)
    
    # Create admin user
    admin_user = {
        "id": str(uuid.uuid4()),
        "email": "admin@cafe.com",
        "name": "Admin User",
        "password": hash_password("admin123"),
        "role": "admin",
        "created_at": datetime.now(timezone.utc)
    }
    await db.users.insert_one(admin_user)

# Routes
@api_router.get("/")
async def root():
    return {"message": "Welcome to Café Delights API"}

# Product endpoints
@api_router.get("/products", response_model=List[Product])
async def get_products(category: Optional[ProductCategory] = None):
    query = {"available": True}
    if category:
        query["category"] = category
    products = await db.products.find(query).to_list(length=None)
    return [Product(**product) for product in products]

@api_router.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str):
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return Product(**product)

@api_router.post("/products", response_model=Product)
async def create_product(product: ProductCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    product_dict = product.dict()
    product_obj = Product(**product_dict)
    await db.products.insert_one(product_obj.dict())
    return product_obj

# User endpoints
@api_router.post("/register")
async def register(user: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_dict = user.dict()
    user_dict["password"] = hash_password(user.password)
    user_obj = User(**user_dict)
    await db.users.insert_one(user_obj.dict())
    
    token = create_token(user_obj.id, user_obj.email, user_obj.role)
    return {"token": token, "user": user_obj}

@api_router.post("/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user or user["password"] != hash_password(credentials.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"], user["email"], user["role"])
    return {"token": token, "user": User(**user)}

@api_router.get("/profile", response_model=User)
async def get_profile(current_user: User = Depends(get_current_user)):
    return current_user

# Order endpoints
@api_router.post("/orders", response_model=Order)
async def create_order(order: OrderCreate, current_user: User = Depends(get_current_user)):
    total_amount = sum(item.price * item.quantity for item in order.items)
    
    order_dict = order.dict()
    order_dict["user_id"] = current_user.id
    order_dict["total_amount"] = total_amount
    order_obj = Order(**order_dict)
    
    await db.orders.insert_one(order_obj.dict())
    return order_obj

@api_router.get("/orders", response_model=List[Order])
async def get_orders(current_user: User = Depends(get_current_user)):
    query = {"user_id": current_user.id} if current_user.role == UserRole.CUSTOMER else {}
    orders = await db.orders.find(query).sort("created_at", -1).to_list(length=None)
    return [Order(**order) for order in orders]

@api_router.get("/orders/{order_id}", response_model=Order)
async def get_order(order_id: str, current_user: User = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if current_user.role == UserRole.CUSTOMER and order["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return Order(**order)

@api_router.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, status: OrderStatus, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc)}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return {"message": "Order status updated"}

# Review endpoints
@api_router.post("/reviews", response_model=Review)
async def create_review(review: ReviewCreate, current_user: User = Depends(get_current_user)):
    # Check if product exists
    product = await db.products.find_one({"id": review.product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    review_dict = review.dict()
    review_dict["user_id"] = current_user.id
    review_dict["user_name"] = current_user.name
    review_obj = Review(**review_dict)
    
    await db.reviews.insert_one(review_obj.dict())
    return review_obj

@api_router.get("/products/{product_id}/reviews", response_model=List[Review])
async def get_product_reviews(product_id: str):
    reviews = await db.reviews.find({"product_id": product_id}).sort("created_at", -1).to_list(length=None)
    return [Review(**review) for review in reviews]

# Search endpoint
@api_router.get("/search/products", response_model=List[Product])
async def search_products(q: str):
    products = await db.products.find({
        "$and": [
            {"available": True},
            {
                "$or": [
                    {"name": {"$regex": q, "$options": "i"}},
                    {"description": {"$regex": q, "$options": "i"}}
                ]
            }
        ]
    }).to_list(length=None)
    return [Product(**product) for product in products]

# Dashboard endpoint for admin
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    total_products = await db.products.count_documents({"available": True})
    total_orders = await db.orders.count_documents({})
    total_users = await db.users.count_documents({"role": "customer"})
    pending_orders = await db.orders.count_documents({"status": "pending"})
    
    return {
        "total_products": total_products,
        "total_orders": total_orders,
        "total_users": total_users,
        "pending_orders": pending_orders
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    await init_sample_data()
    logger.info("Sample data initialized")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()