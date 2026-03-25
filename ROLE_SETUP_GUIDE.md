# Activity Hub Role Setup Guide

**Date:** 2026-03-25
**Status:** Ready for Pi deployment and testing

---

## Summary of Changes

All 4 mini-apps now use the Activity Hub SDK for authentication and role-based access control. The SDK implements:

- Guest user support (no token required)
- Role-based access checks
- Tab-based role hierarchy for multi-tab apps
- Centralized token management via localStorage

---

## App Role Definitions

### **1. Dice** (Guest Accessible)

**Role Requirements:** None (guest_accessible)

```json
{
  "id": "dice",
  "name": "Dice Roller",
  "guest_accessible": true,
  "roles": []
}
```

**Behavior:**
- Works for both authenticated and guest users
- Shows "Playing as Guest" or "Playing as [username]"
- No role checks performed

---

### **2. Tic-Tac-Toe**

**Role Requirements:** `tictactoe:player` (default role)

```json
{
  "id": "tictactoe",
  "name": "Tic-Tac-Toe",
  "roles": [
    {
      "id": "player",
      "name": "Player",
      "description": "Can play Tic-Tac-Toe games",
      "isDefault": true,
      "isRestricted": false
    }
  ]
}
```

**Behavior:**
- All users automatically get `tictactoe:player` role on app registration
- Challenges work seamlessly (everyone has player role by default)
- Admins can revoke role as "ban" mechanism
- Shows error if user doesn't have player role

**Role Assignment:**
- Automatically assigned to all existing users when app is registered
- Automatically assigned to new users when they join

---

### **3. Bulls and Cows**

**Role Requirements:** `bullsandcows:player` (default role)

```json
{
  "id": "bullsandcows",
  "name": "Bulls and Cows",
  "roles": [
    {
      "id": "player",
      "name": "Player",
      "description": "Can play Bulls and Cows games",
      "isDefault": true,
      "isRestricted": false
    }
  ]
}
```

**Behavior:**
- Same as Tic-Tac-Toe
- All users automatically get `bullsandcows:player` role
- Challenges work seamlessly
- Admins can ban by revoking role

---

### **4. Last Man Standing (LMS)** - Tab-Based Roles

**Role Requirements:** Tab hierarchy with 3 levels

```json
{
  "id": "lms",
  "name": "Last Man Standing",
  "roles": [
    {
      "id": "setup",
      "name": "Manager",
      "description": "Full access - can manage setup, games, and view reports",
      "isDefault": false,
      "isRestricted": true
    },
    {
      "id": "games",
      "name": "Game Master",
      "description": "Can manage games and view reports (no setup access)",
      "isDefault": false,
      "isRestricted": true
    },
    {
      "id": "reports",
      "name": "Participant",
      "description": "Can view reports only",
      "isDefault": true,
      "isRestricted": false
    }
  ]
}
```

**Tab Order:** `['setup', 'games', 'reports']`

**Role Hierarchy:**
- `lms:setup` → Access to Setup + Games + Reports tabs (leftmost = most privileges)
- `lms:games` → Access to Games + Reports tabs (middle)
- `lms:reports` → Access to Reports tab only (rightmost = least privileges, default)

**Behavior:**
- Tabs are dynamically hidden based on user roles
- Having a role grants access to that tab + all tabs to its right
- Special role `lms:all` grants access to all tabs (wildcard)
- Default role (`lms:reports`) auto-assigned to all users

---

## Database Setup

### Step 1: Register Apps with Roles

When registering each app, the Activity Hub backend should:

1. Create app entry in `apps` table
2. Create role entries in `ah_roles` table for each role
3. Auto-assign default roles to all existing users

**Example SQL for Tic-Tac-Toe:**

```sql
-- Register app
INSERT INTO apps (id, name, ...) VALUES ('tictactoe', 'Tic-Tac-Toe', ...);

-- Create role
INSERT INTO ah_roles (id, name, description, type, is_default, is_restricted, app_id)
VALUES ('tictactoe:player', 'Player', 'Can play Tic-Tac-Toe games', 'role', true, false, 'tictactoe');

-- Auto-assign to all users (default role)
INSERT INTO user_roles (user_email, role_id)
SELECT email, 'tictactoe:player' FROM users;
```

**Example SQL for LMS (multi-role):**

```sql
-- Register app
INSERT INTO apps (id, name, ...) VALUES ('lms', 'Last Man Standing', ...);

-- Create roles
INSERT INTO ah_roles (id, name, description, type, is_default, is_restricted, app_id) VALUES
('lms:setup', 'Manager', 'Full access', 'role', false, true, 'lms'),
('lms:games', 'Game Master', 'Manage games and reports', 'role', false, true, 'lms'),
('lms:reports', 'Participant', 'View reports', 'role', true, false, 'lms');

-- Auto-assign default role to all users
INSERT INTO user_roles (user_email, role_id)
SELECT email, 'lms:reports' FROM users;
```

### Step 2: Verify Role Assignment

```sql
-- Check all roles
SELECT * FROM ah_roles WHERE app_id IN ('tictactoe', 'bullsandcows', 'lms', 'dice');

-- Check user role assignments
SELECT u.email, u.name, ur.role_id
FROM users u
LEFT JOIN user_roles ur ON u.email = ur.user_email
ORDER BY u.email, ur.role_id;
```

---

## Testing on Pi

### Build and Deploy Sequence

```bash
# 1. Pull latest code on Pi
cd ~/activity-hub && git pull
cd ~/activity-hub-auth && git pull
cd ~/activity-hub-tictactoe && git pull
cd ~/activity-hub-bullsandcows && git pull
cd ~/activity-hub-lms && git pull
cd ~/activity-hub-dice && git pull

# 2. Rebuild and restart services
./start_services.sh
```

### Test Scenarios

#### **Test 1: Guest Access (Dice)**
1. Open Dice app without authentication
2. Verify: Shows "Playing as Guest"
3. Verify: App works without errors

#### **Test 2: Player Role (Tic-Tac-Toe)**
1. Login as regular user
2. Start a Tic-Tac-Toe game
3. Verify: Game loads and works
4. Challenge another user
5. Verify: Opponent can accept and play

#### **Test 3: Ban via Role Revocation**
1. Admin revokes `tictactoe:player` from user
2. User tries to access Tic-Tac-Toe
3. Verify: Shows "Access Denied" message
4. Verify: Cannot play or be challenged

#### **Test 4: LMS Tab Hierarchy**
1. **Participant (lms:reports only):**
   - Verify: Only Reports tab visible
   - Verify: Cannot see Setup or Games tabs

2. **Game Master (lms:games):**
   - Verify: Games and Reports tabs visible
   - Verify: Setup tab hidden

3. **Manager (lms:setup):**
   - Verify: All 3 tabs visible (Setup, Games, Reports)

#### **Test 5: New User Auto-Assignment**
1. Create new user via admin UI
2. Verify: User automatically has default roles:
   - `tictactoe:player`
   - `bullsandcows:player`
   - `lms:reports`
3. Verify: User can access all apps appropriately

---

## Common Issues and Solutions

### Issue: "No authentication token"
**Cause:** SDK couldn't find token in localStorage or URL params
**Fix:** Ensure Activity Hub passes `token` in iframe URL

### Issue: "You don't have permission"
**Cause:** User missing required role
**Fix:** Check `user_roles` table, manually assign role if needed:
```sql
INSERT INTO user_roles (user_email, role_id) VALUES ('user@example.com', 'tictactoe:player');
```

### Issue: LMS shows no tabs
**Cause:** User has no LMS roles
**Fix:** Assign at least `lms:reports` (default role):
```sql
INSERT INTO user_roles (user_email, role_id) VALUES ('user@example.com', 'lms:reports');
```

### Issue: Tabs not hiding/showing correctly
**Cause:** Role hierarchy logic issue
**Fix:** Verify tab order in App.tsx matches role naming: `['setup', 'games', 'reports']`

---

## SDK API Reference

### useActivityHubContext()

Returns context with user and roles:

```typescript
const { user, roles } = useActivityHubContext();

// User object
user.email      // "user@example.com"
user.name       // "John Doe"
user.isGuest    // true if no token (guest mode)

// Role checking
roles.hasApp('player')              // Check for app-specific role
roles.has('tictactoe:player')       // Check exact role
roles.hasAny(['role1', 'role2'])    // Check if has any of these
roles.hasAll(['role1', 'role2'])    // Check if has all of these
roles.isAdmin                       // Has Activity Hub admin privileges

// Tab-based access (for multi-tab apps)
roles.hasTabAccess('games', ['setup', 'games', 'reports'])
roles.getAccessibleTabs(['setup', 'games', 'reports'])  // Returns accessible tabs array
```

---

## Backend API Updates Needed

The Activity Hub backend should support:

1. **App Registration with Roles:**
   - POST `/api/admin/apps` should accept `roles` array
   - Auto-create entries in `ah_roles` table
   - Auto-assign default roles to all users

2. **User Context Endpoint:**
   - GET `/api/user/context` should return expanded roles (including group roles)
   - Already implemented in commit 25564ef

3. **Role Management:**
   - Admin UI for managing roles (already exists)
   - User role assignment (already exists)

---

## Commits Summary

| Repo | Commit | Description |
|------|--------|-------------|
| activity-hub-auth | bc738b0 | Add tab-based role access helpers |
| activity-hub (SDK) | 8aa468e | Add tab-based role access and guest support to SDK |
| activity-hub-dice | e2d16d8 | Add SDK authentication (guest support) |
| activity-hub-tictactoe | 34465e8 | Add SDK role-based authentication |
| activity-hub-bullsandcows | 039d8f2 | Add SDK role-based authentication |
| activity-hub-lms | 5e03542 | Add SDK tab-based role access |

---

## Next Steps

1. **Push changes** from Mac (user does this manually)
2. **Pull on Pi** and rebuild all services
3. **Register apps** with role definitions in database
4. **Test each scenario** above
5. **Report any issues** back for fixes

---

**All code is committed and ready for Pi deployment!**
