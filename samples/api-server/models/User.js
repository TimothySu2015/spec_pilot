const bcrypt = require('bcryptjs');
const { DatabaseError } = require('../errors/DiagnosticError');

/**
 * User Model (記憶體資料庫模擬)
 */
class User {
  constructor() {
    // 模擬資料庫
    this.users = [
      {
        id: 1,
        username: 'admin',
        email: 'admin@example.com',
        password: bcrypt.hashSync('admin123', 10), // 密碼: admin123
        age: 30,
        createdAt: new Date().toISOString(),
      },
      {
        id: 2,
        username: 'user1',
        email: 'user1@example.com',
        password: bcrypt.hashSync('user123', 10), // 密碼: user123
        age: 25,
        createdAt: new Date().toISOString(),
      },
    ];
    this.nextId = 3;
  }

  /**
   * 根據 ID 查詢使用者
   */
  async findById(id) {
    try {
      const user = this.users.find(u => u.id === parseInt(id));
      return user || null;
    } catch (error) {
      throw new DatabaseError('查詢使用者時發生錯誤', {
        details: { operation: 'findById', userId: id, error: error.message }
      });
    }
  }

  /**
   * 根據使用者名稱查詢
   */
  async findByUsername(username) {
    try {
      const user = this.users.find(u => u.username === username);
      return user || null;
    } catch (error) {
      throw new DatabaseError('查詢使用者時發生錯誤', {
        details: { operation: 'findByUsername', username, error: error.message }
      });
    }
  }

  /**
   * 根據 Email 查詢
   */
  async findByEmail(email) {
    try {
      const user = this.users.find(u => u.email === email);
      return user || null;
    } catch (error) {
      throw new DatabaseError('查詢使用者時發生錯誤', {
        details: { operation: 'findByEmail', email, error: error.message }
      });
    }
  }

  /**
   * 取得所有使用者
   */
  async findAll() {
    try {
      return this.users;
    } catch (error) {
      throw new DatabaseError('查詢使用者清單時發生錯誤', {
        details: { operation: 'findAll', error: error.message }
      });
    }
  }

  /**
   * 建立使用者
   */
  async create(userData) {
    try {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const newUser = {
        id: this.nextId++,
        username: userData.username,
        email: userData.email,
        password: hashedPassword,
        age: userData.age,
        createdAt: new Date().toISOString(),
      };
      this.users.push(newUser);
      return newUser;
    } catch (error) {
      throw new DatabaseError('建立使用者時發生錯誤', {
        details: { operation: 'create', userData, error: error.message }
      });
    }
  }

  /**
   * 更新使用者
   */
  async update(id, updateData) {
    try {
      const index = this.users.findIndex(u => u.id === parseInt(id));
      if (index === -1) return null;

      // 如果更新密碼,需要 hash
      if (updateData.password) {
        updateData.password = await bcrypt.hash(updateData.password, 10);
      }

      this.users[index] = {
        ...this.users[index],
        ...updateData,
        id: parseInt(id), // 確保 ID 不被更改
      };
      return this.users[index];
    } catch (error) {
      throw new DatabaseError('更新使用者時發生錯誤', {
        details: { operation: 'update', userId: id, error: error.message }
      });
    }
  }

  /**
   * 刪除使用者
   */
  async delete(id) {
    try {
      const index = this.users.findIndex(u => u.id === parseInt(id));
      if (index === -1) return false;

      this.users.splice(index, 1);
      return true;
    } catch (error) {
      throw new DatabaseError('刪除使用者時發生錯誤', {
        details: { operation: 'delete', userId: id, error: error.message }
      });
    }
  }

  /**
   * 驗證密碼
   */
  async comparePassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  /**
   * 移除密碼欄位 (避免回傳給客戶端)
   */
  sanitizeUser(user) {
    if (!user) return null;
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}

// 單例模式
module.exports = new User();
