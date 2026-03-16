# Authentication & Self-Registration Guide

## Overview

Activity Hub uses email-based authentication with self-registration and password recovery flows.

**Key Features:**
- ✅ Bootstrap admin user (pre-created in database)
- ✅ Self-registration with email verification
- ✅ Password reset via email link
- ✅ Bcrypt password hashing
- ✅ Single-use verification tokens (24h expiry for signup, 1h for reset)

---

## Database Tables

### users
```sql
email VARCHAR(255) PRIMARY KEY
name VARCHAR(255)                    -- NULL until email verified
code_hash VARCHAR(255)               -- Bcrypt hash of password
email_verified BOOLEAN               -- Email confirmed?
verified_at TIMESTAMP                -- When verification happened
is_admin, roles, created_at, updated_at
```

### email_verifications
```sql
token VARCHAR(255) UNIQUE            -- Random token sent in email
email VARCHAR(255)                   -- Email being verified
purpose VARCHAR(50)                  -- 'signup' or 'email_change'
expires_at TIMESTAMP                 -- 24 hours for signup
used_at TIMESTAMP                    -- NULL until used (single-use)
```

### password_resets
```sql
token VARCHAR(255) UNIQUE            -- Random token sent in email
email VARCHAR(255) FK users          -- User's email
expires_at TIMESTAMP                 -- 1 hour
used_at TIMESTAMP                    -- NULL until used (single-use)
```

---

## Bootstrap Admin User

**Pre-created in init.sql:**

| Field | Value |
|-------|-------|
| Email | admin@activity-hub.com |
| Name | Admin |
| Password | 123456 |
| Code Hash | `$2a$10$bz7aFH/Yx4h7zyKLa6.cXe4x/L1pFWrU9.rEqf6TK7j2bJ8w7dEyO` |
| Email Verified | TRUE |
| Roles | super_user, setup_admin |

**Generate password hash:**
```bash
# Generate bcrypt hash for any password
echo "123456" | htpasswd -nbBC 10 admin | cut -d: -f2

# Or in Go
import "golang.org/x/crypto/bcrypt"
hash, _ := bcrypt.GenerateFromPassword([]byte("123456"), bcrypt.DefaultCost)
fmt.Println(string(hash))
```

---

## API Endpoints to Implement

### 1. Login

```
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@activity-hub.com",
  "code": "123456"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "token": "demo-token-admin@activity-hub.com",
  "user": {
    "email": "admin@activity-hub.com",
    "name": "Admin",
    "is_admin": true,
    "roles": ["super_user", "setup_admin"]
  }
}
```

**Response (Failure - 401):**
```json
{
  "success": false,
  "error": "Invalid credentials"
}
```

**Implementation:**
1. Query users table for email
2. If not found → 401
3. Verify code_hash with bcrypt.CompareHashAndPassword([]byte(user.CodeHash), []byte(code))
4. If bcrypt fails → 401
5. If email_verified = false → 401 (must verify email first)
6. Generate token: `demo-token-{email}`
7. Return token and user info

---

### 2. Register (Start Sign-Up)

```
POST /api/auth/register
Content-Type: application/json

{
  "email": "alice@example.com"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Verification email sent to alice@example.com"
}
```

**Response (Conflict - 409):**
```json
{
  "success": false,
  "error": "Email already registered"
}
```

**Implementation:**
1. Validate email format
2. Check if email already exists in users table
3. If exists → 409 Conflict
4. Create user with:
   - email (PK)
   - name = NULL (not set yet)
   - code_hash = NULL (no password yet)
   - email_verified = FALSE
   - verified_at = NULL
5. Generate random token (e.g., crypto/rand 32 bytes, base64 encode)
6. Insert into email_verifications:
   - token = random_token
   - email = email
   - purpose = 'signup'
   - expires_at = NOW() + 24 HOURS
   - used_at = NULL
7. Send email with verification link:
   ```
   Click to verify: http://your-domain/verify-email?token={token}
   Link expires in 24 hours
   ```
8. Return 200 with success message

---

### 3. Verify Email (Complete Sign-Up)

```
POST /api/auth/verify-email
Content-Type: application/json

{
  "token": "eyJhbGc...",
  "password": "user_chosen_password"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "token": "demo-token-alice@example.com",
  "user": {
    "email": "alice@example.com",
    "name": "alice@example.com",
    "roles": []
  }
}
```

**Response (Invalid Token - 400):**
```json
{
  "success": false,
  "error": "Invalid or expired verification token"
}
```

**Implementation:**
1. Find email_verifications record by token
2. If not found or used_at != NULL → 400 (invalid or already used)
3. If expires_at < NOW() → 400 (expired)
4. If purpose != 'signup' → 400 (wrong token type)
5. Hash password with bcrypt (cost 10)
6. Update users table:
   - name = email (or let user choose name)
   - code_hash = bcrypt_hash
   - email_verified = TRUE
   - verified_at = NOW()
7. Mark token as used:
   - UPDATE email_verifications SET used_at = NOW() WHERE token = {token}
8. Generate auth token: `demo-token-{email}`
9. Return 200 with token

---

### 4. Request Password Reset

```
POST /api/auth/request-password-reset
Content-Type: application/json

{
  "email": "alice@example.com"
}
```

**Response (Always 200 for security):**
```json
{
  "success": true,
  "message": "Password reset email sent"
}
```

**Implementation Notes:**
- Always return 200 (don't leak whether email exists)
- Check if user exists in users table
- If doesn't exist → return 200 anyway (silent fail for security)
- If exists:
  1. Generate random token (same as registration)
  2. Insert into password_resets:
     - token = random_token
     - email = email
     - expires_at = NOW() + 1 HOUR
     - used_at = NULL
  3. Send email with reset link:
     ```
     Click to reset: http://your-domain/reset-password?token={token}
     Link expires in 1 hour
     ```
- Return 200 regardless

---

### 5. Reset Password

```
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "eyJhbGc...",
  "password": "new_password"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Password reset successfully",
  "token": "demo-token-alice@example.com"
}
```

**Response (Invalid Token - 400):**
```json
{
  "success": false,
  "error": "Invalid or expired reset token"
}
```

**Implementation:**
1. Find password_resets record by token
2. If not found or used_at != NULL → 400 (invalid or already used)
3. If expires_at < NOW() → 400 (expired)
4. Get email from password_resets.email
5. Hash new password with bcrypt
6. Update users table:
   - code_hash = bcrypt_hash
   - updated_at = NOW()
7. Mark token as used:
   - UPDATE password_resets SET used_at = NOW() WHERE token = {token}
8. Generate auth token: `demo-token-{email}`
9. Return 200 with token

---

## Email Templates

### Verification Email (Sign-Up)

```
Subject: Verify your Activity Hub email

Hi,

Click the link below to verify your email and set your password:

http://your-domain/verify-email?token={token}

This link expires in 24 hours.

If you didn't request this, you can safely ignore this email.

---
Activity Hub
```

### Password Reset Email

```
Subject: Reset your Activity Hub password

Hi,

Click the link below to reset your password:

http://your-domain/reset-password?token={token}

This link expires in 1 hour.

If you didn't request this, you can safely ignore this email.

---
Activity Hub
```

---

## Frontend Pages Needed

### 1. `/verify-email` (Sign-Up Verification)

**URL Params:** `?token={token}`

**Flow:**
1. Extract token from URL
2. Show "Setting password..." message
3. Ask user for password (at least 8 chars recommended)
4. On submit:
   ```
   POST /api/auth/verify-email
   {
     "token": token,
     "password": password
   }
   ```
5. If success: Redirect to login or auto-login with returned token
6. If error: Show error message, option to request new verification email

### 2. `/reset-password` (Password Reset)

**URL Params:** `?token={token}`

**Flow:**
1. Extract token from URL
2. Ask user for new password
3. On submit:
   ```
   POST /api/auth/reset-password
   {
     "token": token,
     "password": password
   }
   ```
4. If success: Redirect to login or auto-login with returned token
5. If error: Show error message (likely expired token)

### 3. `/forgot-password` (Request Reset)

**Flow:**
1. Ask user for email address
2. On submit:
   ```
   POST /api/auth/request-password-reset
   {
     "email": email
   }
   ```
3. Show: "Check your email for reset link"
4. Link to login page

---

## Security Considerations

### Password Requirements
- Minimum 8 characters (recommended)
- No other restrictions (allow any characters)
- Bcrypt handles complexity internally

### Token Generation
```go
import "crypto/rand"
import "encoding/base64"

func generateToken() (string, error) {
    b := make([]byte, 32)  // 256 bits
    if _, err := rand.Read(b); err != nil {
        return "", err
    }
    return base64.URLEncoding.EncodeToString(b), nil
}
```

### Rate Limiting
- Consider rate-limiting on `/register` and `/request-password-reset`
- Prevent email enumeration attacks
- Example: Max 5 requests per minute per IP for registration

### Token Expiry
- Signup verification: 24 hours (users have time to check email)
- Password reset: 1 hour (more sensitive, shorter window)

### Email Validation
- Basic format check: `strings.Contains(email, "@")`
- Or use stdlib mail.ParseAddress()
- Don't block common domains (outlook.com, gmail.com, etc.)

### HTTPS Required
- All auth endpoints must use HTTPS in production
- Demo tokens sent in response - protect with TLS

---

## Testing the Flow

### Test 1: Admin Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@activity-hub.com",
    "code": "123456"
  }'
```

Expected: Token returned

### Test 2: User Registration
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com"}'
```

Expected: Email sent (or check database for email_verifications record)

### Test 3: Verify Email
```bash
# Get token from email_verifications table
TOKEN="..."

curl -X POST http://localhost:3001/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "token": "'$TOKEN'",
    "password": "newpassword123"
  }'
```

Expected: Token returned, user can now login

### Test 4: Password Reset
```bash
# Request reset
curl -X POST http://localhost:3001/api/auth/request-password-reset \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com"}'

# Get token from password_resets table
TOKEN="..."

curl -X POST http://localhost:3001/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "'$TOKEN'",
    "password": "anotherpassword456"
  }'
```

Expected: Token returned, user can login with new password

---

## Implementation Checklist

- [ ] Hash comparison: bcrypt for password verification
- [ ] Token generation: 32-byte random tokens, base64 encoded
- [ ] Email sending: SMTP or email service integration
- [ ] Database schema: 9 tables with email_verifications and password_resets
- [ ] Endpoints: POST /login, /register, /verify-email, /request-password-reset, /reset-password
- [ ] Frontend pages: /verify-email, /reset-password, /forgot-password
- [ ] Email templates: Signup verification and password reset emails
- [ ] Testing: Manual tests for all flows
- [ ] Rate limiting: Prevent abuse on registration and reset
- [ ] HTTPS: Ensure production uses TLS
- [ ] Error handling: Don't leak whether email exists

---

## References

- Database: See init.sql for schema
- Bootstrap: admin@activity-hub.com / 123456
- Token format: `demo-token-{email}` (internal use)
- Bcrypt library: `golang.org/x/crypto/bcrypt`

---

**Status:** Authentication schema ready, endpoints need implementation
**Last Updated:** 2026-03-16
