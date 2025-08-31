# Environment Configuration Guide

This guide explains all available environment variables for configuring the Soldier Sign-Out System.

## Server Configuration

### PORT
- **Default**: `3000`
- **Description**: Port number the server will listen on
- **Example**: `PORT=8080`

### NODE_ENV
- **Default**: `development`
- **Options**: `development`, `production`, `test`
- **Description**: Node.js environment mode
- **Example**: `NODE_ENV=production`

### HOST
- **Default**: `localhost`
- **Description**: Host address for the server
- **Example**: `HOST=0.0.0.0`

### CORS_ORIGIN
- **Default**: `*`
- **Description**: CORS origin policy for API requests
- **Example**: `CORS_ORIGIN=https://yourdomain.com`

## Database Configuration

### DB_PATH
- **Default**: `./data/soldiers.db`
- **Description**: Path to SQLite database file
- **Example**: `DB_PATH=/var/lib/signouts/database.db`

### DB_BACKUP_ENABLED
- **Default**: `true`
- **Description**: Enable automatic database backups
- **Example**: `DB_BACKUP_ENABLED=false`

### DB_BACKUP_INTERVAL
- **Default**: `24`
- **Description**: Backup interval in hours
- **Example**: `DB_BACKUP_INTERVAL=12`

### DB_MAX_CONNECTIONS
- **Default**: `10`
- **Description**: Maximum concurrent database connections
- **Example**: `DB_MAX_CONNECTIONS=20`

## Security Settings

### SESSION_SECRET
- **Default**: `your-secret-key-here`
- **Description**: Secret key for session encryption (CHANGE IN PRODUCTION!)
- **Example**: `SESSION_SECRET=your-super-secure-random-key-here`

### SESSION_MAX_AGE
- **Default**: `86400000` (24 hours)
- **Description**: Session expiration time in milliseconds
- **Example**: `SESSION_MAX_AGE=43200000` (12 hours)

### ENABLE_HTTPS
- **Default**: `false`
- **Description**: Force HTTPS connections
- **Example**: `ENABLE_HTTPS=true`

### REQUIRE_SECURE_COOKIES
- **Default**: `false`
- **Description**: Require secure cookies (HTTPS only)
- **Example**: `REQUIRE_SECURE_COOKIES=true`

### CSP_ENABLED
- **Default**: `true`
- **Description**: Enable Content Security Policy headers
- **Example**: `CSP_ENABLED=false`

### RATE_LIMIT_ENABLED
- **Default**: `true`
- **Description**: Enable API rate limiting
- **Example**: `RATE_LIMIT_ENABLED=false`

### MAX_REQUESTS_PER_MINUTE
- **Default**: `100`
- **Description**: Maximum API requests per minute per IP
- **Example**: `MAX_REQUESTS_PER_MINUTE=50`

## Authentication & Authorization

### DEFAULT_ADMIN_PIN
- **Default**: `1234`
- **Description**: Default admin PIN (CHANGE IN PRODUCTION!)
- **Example**: `DEFAULT_ADMIN_PIN=9876`

### PIN_MIN_LENGTH
- **Default**: `4`
- **Description**: Minimum PIN length requirement
- **Example**: `PIN_MIN_LENGTH=6`

### PIN_MAX_ATTEMPTS
- **Default**: `3`
- **Description**: Maximum failed PIN attempts before lockout
- **Example**: `PIN_MAX_ATTEMPTS=5`

### LOCKOUT_DURATION
- **Default**: `300000` (5 minutes)
- **Description**: Account lockout duration in milliseconds
- **Example**: `LOCKOUT_DURATION=600000` (10 minutes)

### PASSWORD_COMPLEXITY_REQUIRED
- **Default**: `false`
- **Description**: Require complex passwords/PINs
- **Example**: `PASSWORD_COMPLEXITY_REQUIRED=true`

## Application Settings

### AUTO_REFRESH_INTERVAL
- **Default**: `30000` (30 seconds)
- **Description**: Auto-refresh interval for dashboard in milliseconds
- **Example**: `AUTO_REFRESH_INTERVAL=60000` (1 minute)

### DEFAULT_RETURN_HOURS
- **Default**: `4`
- **Description**: Default expected return time in hours
- **Example**: `DEFAULT_RETURN_HOURS=8`

### MAX_SIGNOUT_DURATION
- **Default**: `72`
- **Description**: Maximum sign-out duration in hours
- **Example**: `MAX_SIGNOUT_DURATION=48`

### TIMEZONE
- **Default**: `America/New_York`
- **Description**: System timezone for timestamps
- **Example**: `TIMEZONE=America/Los_Angeles`

### DATE_FORMAT
- **Default**: `MM/DD/YYYY`
- **Description**: Date display format
- **Example**: `DATE_FORMAT=DD/MM/YYYY`

### TIME_FORMAT
- **Default**: `12h`
- **Options**: `12h`, `24h`
- **Description**: Time display format
- **Example**: `TIME_FORMAT=24h`

## Audit & Logging

### AUDIT_LOG_ENABLED
- **Default**: `true`
- **Description**: Enable audit logging
- **Example**: `AUDIT_LOG_ENABLED=false`

### AUDIT_LOG_RETENTION_DAYS
- **Default**: `90`
- **Description**: Days to retain audit logs
- **Example**: `AUDIT_LOG_RETENTION_DAYS=180`

### SYSTEM_LOG_LEVEL
- **Default**: `info`
- **Options**: `error`, `warn`, `info`, `debug`
- **Description**: System logging level
- **Example**: `SYSTEM_LOG_LEVEL=debug`

### LOG_TO_FILE
- **Default**: `false`
- **Description**: Enable file logging
- **Example**: `LOG_TO_FILE=true`

### LOG_FILE_PATH
- **Default**: `./logs/app.log`
- **Description**: Path for log files
- **Example**: `LOG_FILE_PATH=/var/log/signouts/app.log`

## Performance & Limits

### MAX_SOLDIERS_PER_SIGNOUT
- **Default**: `50`
- **Description**: Maximum soldiers per sign-out group
- **Example**: `MAX_SOLDIERS_PER_SIGNOUT=25`

### SEARCH_RESULTS_LIMIT
- **Default**: `100`
- **Description**: Maximum search results returned
- **Example**: `SEARCH_RESULTS_LIMIT=50`

### PAGINATION_DEFAULT_SIZE
- **Default**: `25`
- **Description**: Default pagination size
- **Example**: `PAGINATION_DEFAULT_SIZE=50`

### CACHE_ENABLED
- **Default**: `true`
- **Description**: Enable application caching
- **Example**: `CACHE_ENABLED=false`

### CACHE_TTL
- **Default**: `300` (5 minutes)
- **Description**: Cache time-to-live in seconds
- **Example**: `CACHE_TTL=600` (10 minutes)

## Notifications & UI

### NOTIFICATION_DURATION
- **Default**: `5000` (5 seconds)
- **Description**: Notification display duration in milliseconds
- **Example**: `NOTIFICATION_DURATION=3000` (3 seconds)

### AUTO_CLOSE_MODALS
- **Default**: `false`
- **Description**: Automatically close modals after successful actions
- **Example**: `AUTO_CLOSE_MODALS=true`

### CONFIRM_DANGEROUS_ACTIONS
- **Default**: `true`
- **Description**: Require confirmation for dangerous actions
- **Example**: `CONFIRM_DANGEROUS_ACTIONS=false`

### SHOW_SYSTEM_INFO
- **Default**: `false`
- **Description**: Show system information in UI
- **Example**: `SHOW_SYSTEM_INFO=true`

## Development/Debug Settings

### SHOW_NO_CAC_LINK
- **Default**: `false`
- **Description**: Show "No CAC?" link for manual entry
- **Example**: `SHOW_NO_CAC_LINK=true`

### SHOW_DEV_BUTTON
- **Default**: `false`
- **Description**: Show development fill button
- **Example**: `SHOW_DEV_BUTTON=true`

### DEBUG_MODE
- **Default**: `false`
- **Description**: Enable debug mode with verbose logging
- **Example**: `DEBUG_MODE=true`

### MOCK_BARCODE_DATA
- **Default**: `false`
- **Description**: Use mock barcode data for testing
- **Example**: `MOCK_BARCODE_DATA=true`

### ENABLE_API_DOCS
- **Default**: `false`
- **Description**: Enable API documentation endpoints
- **Example**: `ENABLE_API_DOCS=true`

## Environment Examples

### Development Environment
```env
NODE_ENV=development
DEBUG_MODE=true
SHOW_NO_CAC_LINK=true
SHOW_DEV_BUTTON=true
MOCK_BARCODE_DATA=true
ENABLE_API_DOCS=true
LOG_TO_FILE=false
```

### Production Environment
```env
NODE_ENV=production
SESSION_SECRET=your-actual-secure-key
ENABLE_HTTPS=true
REQUIRE_SECURE_COOKIES=true
SHOW_NO_CAC_LINK=false
SHOW_DEV_BUTTON=false
DEBUG_MODE=false
LOG_TO_FILE=true
RATE_LIMIT_ENABLED=true
MAX_REQUESTS_PER_MINUTE=50
```

### Testing Environment
```env
NODE_ENV=test
DB_PATH=./test/test.db
SHOW_NO_CAC_LINK=true
SHOW_DEV_BUTTON=true
MOCK_BARCODE_DATA=true
AUDIT_LOG_ENABLED=false
AUTO_REFRESH_INTERVAL=10000
```

## Security Best Practices

1. **Always change default secrets in production**
2. **Use strong session secrets (32+ random characters)**
3. **Enable HTTPS in production environments**
4. **Set appropriate rate limits**
5. **Disable debug features in production**
6. **Use secure file permissions for .env files**
7. **Never commit .env files to version control**
8. **Regularly rotate session secrets**
9. **Monitor audit logs for suspicious activity**
10. **Use environment-specific configurations**
