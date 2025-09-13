# 🔧 Fix for Data Loss on Render.com Free Tier

## ❌ **The Problem**
On Render.com's free tier, **all files are deleted when the service restarts**. This means:
- Your SQLite database file (`./database/instabot.db`) gets wiped
- All usernames, quotes, and image metadata disappear
- **Only the images survive** (because they're stored on Discord's CDN)

## ✅ **The Solution**
Switch from **SQLite** (file-based) to **PostgreSQL** (cloud-hosted) for persistent data storage.

---

## 🚀 **Implementation Steps**

### **1. Create PostgreSQL Database on Render**

1. **Go to Render.com Dashboard**
2. **Click "New +"** → **"PostgreSQL"**
3. **Fill out the form**:
   - **Name**: `instabot-postgres`
   - **Database**: `instabot`
   - **User**: `instabot_user`
   - **Region**: Choose closest to your web service
   - **PostgreSQL Version**: 15 (default)
   - **Datadog API Key**: Leave blank
4. **Click "Create Database"**
5. **Wait 2-3 minutes** for database to be ready

### **2. Get Database Connection URL**

1. **Click on your new PostgreSQL service**
2. **Go to "Info" tab**
3. **Copy the "External Database URL"** (starts with `postgresql://`)
   - Example: `postgresql://instabot_user:password@host:port/instabot`

### **3. Update Environment Variables**

1. **Go to your Web Service** (your bot)
2. **Go to "Environment" tab**
3. **Add new environment variable**:
   - **Key**: `DATABASE_URL`
   - **Value**: Paste the PostgreSQL URL you copied
4. **Click "Save Changes"**

### **4. Deploy the Updated Code**

The code is already configured to automatically switch to PostgreSQL when `DATABASE_URL` is detected!

**Push your updates**:
```bash
git add .
git commit -m "Add PostgreSQL support for persistent storage"
git push origin main
```

**Render will automatically redeploy** when it detects the push.

---

## 🔍 **How It Works**

### **Automatic Database Selection**
The bot now **automatically chooses** the right database:

```javascript
// In utils/database.js
if (config.usePostgres) {
  console.log('🐘 Using PostgreSQL for persistent storage');
  return require('./database-postgres');
} else {
  console.log('📁 Using SQLite for local storage');
  return require('./database-sqlite');
}
```

### **Environment Detection**
```javascript
// In config.js
usePostgres: !!process.env.DATABASE_URL // Auto-detect PostgreSQL
```

### **What Gets Stored Where**
- **PostgreSQL**: User profiles, usernames, quotes, image metadata, likes
- **Discord CDN**: Actual image files (unchanged)
- **No Local Files**: Everything persists through restarts!

---

## 🎯 **Verification Steps**

### **1. Check Logs**
After deployment, check your Render logs for:
```
🐘 Using PostgreSQL for persistent storage
✅ PostgreSQL database initialized successfully
```

### **2. Test Data Persistence**
1. **Use `/setusername testuser`**
2. **Upload an image with `/upload`**
3. **Add a quote with `/addquote`**
4. **Manually restart your service**:
   - Go to Render dashboard
   - Click "Manual Deploy" → "Clear build cache & deploy"
5. **Test `/profile`** - everything should still be there!

---

## 💡 **Benefits of This Fix**

### **✅ Persistent Data**
- Usernames survive restarts
- Quotes survive restarts
- Like counts survive restarts
- Image metadata survives restarts

### **✅ Zero Cost**
- PostgreSQL on Render is **FREE** (up to 1GB)
- Discord CDN is **FREE** (unlimited images)
- Total cost: **$0/month**

### **✅ Better Performance**
- PostgreSQL is faster than SQLite for concurrent users
- Better indexing and query optimization
- Cloud-hosted, no file I/O bottlenecks

### **✅ Automatic Scaling**
- No manual database management
- Automatic backups
- Connection pooling included

---

## 🛠️ **Local Development**

### **For Local Testing (SQLite)**
```bash
# Remove DATABASE_URL from .env for local development
# The bot will automatically use SQLite locally
npm run dev
```

### **For Local Testing (PostgreSQL)**
```bash
# Add DATABASE_URL to .env for PostgreSQL testing
echo "DATABASE_URL=postgresql://localhost:5432/instabot_local" >> .env
npm run dev
```

---

## 🔧 **Troubleshooting**

### **Database Connection Errors**
```
Error: connect ECONNREFUSED
```
**Solutions**:
- Verify `DATABASE_URL` is correct
- Check PostgreSQL service is running
- Ensure your IP isn't blocked

### **Migration Issues**
If you had data in SQLite and want to migrate:

1. **Export from SQLite** (before switching):
```bash
sqlite3 ./database/instabot.db .dump > backup.sql
```

2. **Manually recreate important data** in PostgreSQL
3. **Or use the Discord backup system** (already built-in)

### **Performance Issues**
If PostgreSQL seems slow:
- Check your PostgreSQL service region matches your web service
- Monitor connection pool usage
- Consider upgrading to paid PostgreSQL tier if needed

---

## 🎉 **Success!**

Your Instagram Discord Bot now has **100% persistent data storage** that survives all restarts and deploys!

**No more lost usernames, quotes, or image metadata!** 🚀

---

## 📊 **Resource Usage After Fix**

### **Free Tier Resources**
- **Web Service**: 512MB RAM, shared CPU (unchanged)
- **PostgreSQL**: 1GB storage, shared compute (FREE)
- **Total Cost**: **$0/month**

### **Estimated Capacity**
- **Users**: 10,000+ profiles
- **Images**: Unlimited (Discord CDN)
- **Quotes**: 30,000+ quotes
- **Likes**: 100,000+ likes

**Your bot can now scale significantly without data loss!** 🎯
