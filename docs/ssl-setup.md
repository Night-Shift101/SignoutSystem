# SSL/HTTPS Setup Guide

This guide explains how to enable SSL/HTTPS for localhost development.

## Quick Start

### 1. Generate Self-Signed Certificates (if needed)
```bash
npm run generate-certs
```

### 2. Enable HTTPS in Environment
Edit your `.env` file:
```env
ENABLE_HTTPS=true
SSL_CRT_FILE=./cert.crt
SSL_KEY_FILE=./cert.key
```

### 3. Start with SSL
```bash
# Start with SSL using npm script
npm run start:ssl

# Or for development with auto-reload
npm run dev:ssl

# Or manually set environment variables
ENABLE_HTTPS=true SSL_CRT_FILE=./cert.crt SSL_KEY_FILE=./cert.key npm start
```

## Available NPM Scripts

- `npm start` - Start server with HTTP
- `npm run start:ssl` - Start server with HTTPS
- `npm run dev` - Development mode with HTTP
- `npm run dev:ssl` - Development mode with HTTPS
- `npm run generate-certs` - Generate self-signed certificates

## Environment Variables

### ENABLE_HTTPS
- **Default**: `false`
- **Description**: Enable HTTPS/SSL mode
- **Example**: `ENABLE_HTTPS=true`

### SSL_CRT_FILE
- **Default**: `./cert.crt`
- **Description**: Path to SSL certificate file
- **Example**: `SSL_CRT_FILE=/path/to/certificate.crt`

### SSL_KEY_FILE
- **Default**: `./cert.key`
- **Description**: Path to SSL private key file
- **Example**: `SSL_KEY_FILE=/path/to/private.key`

## Certificate Options

### Option 1: Self-Signed Certificates (Development)
```bash
# Generate using npm script
npm run generate-certs

# Or manually with OpenSSL
openssl req -x509 -newkey rsa:4096 -keyout cert.key -out cert.crt -days 365 -nodes -subj '/CN=localhost'
```

### Option 2: mkcert (Recommended for Development)
```bash
# Install mkcert
brew install mkcert  # macOS
# or
choco install mkcert  # Windows

# Install local CA
mkcert -install

# Generate certificates
mkcert localhost 127.0.0.1 ::1
```

### Option 3: Production Certificates
For production, use certificates from a Certificate Authority like:
- Let's Encrypt (free)
- DigiCert
- Comodo
- GlobalSign

## Browser Warnings

### Self-Signed Certificates
- Browsers will show security warnings
- Click "Advanced" → "Proceed to localhost (unsafe)"
- This is normal for development

### Trusted Certificates (mkcert)
- No browser warnings
- Automatically trusted by system

## Troubleshooting

### Certificate Not Found Error
```
❌ SSL certificate files not found!
📁 Expected cert file: ./cert.crt
🔑 Expected key file: ./cert.key
💡 Run "npm run generate-certs" to create self-signed certificates
```

**Solution**: Generate certificates or check file paths

### Port Already in Use
```
Error: listen EADDRINUSE :::3000
```

**Solution**: 
- Change PORT in `.env` file
- Or kill existing process: `lsof -ti:3000 | xargs kill`

### Session Issues with HTTPS
- Cookies automatically become secure with HTTPS
- Clear browser cookies if switching between HTTP/HTTPS
- Session data may not persist when switching protocols

## Security Notes

### Development
- Self-signed certificates are fine for development
- Browser warnings are expected and safe to ignore
- Don't use self-signed certificates in production

### Production
- Always use valid SSL certificates in production
- Set `ENABLE_HTTPS=true` in production environment
- Use secure session secrets
- Consider additional security headers

## Example Configurations

### Development (HTTP)
```env
ENABLE_HTTPS=false
NODE_ENV=development
```

### Development (HTTPS)
```env
ENABLE_HTTPS=true
SSL_CRT_FILE=./cert.crt
SSL_KEY_FILE=./cert.key
NODE_ENV=development
```

### Production (HTTPS)
```env
ENABLE_HTTPS=true
SSL_CRT_FILE=/etc/ssl/certs/yourdomain.crt
SSL_KEY_FILE=/etc/ssl/private/yourdomain.key
NODE_ENV=production
SESSION_SECRET=your-actual-secure-secret-here
```

## Testing SSL Setup

1. Start the server with SSL: `npm run start:ssl`
2. Open browser to: `https://localhost:3000`
3. Accept security warning (for self-signed certs)
4. Verify SSL is working in browser address bar (lock icon)

## Additional Resources

- [mkcert GitHub](https://github.com/FiloSottile/mkcert)
- [OpenSSL Documentation](https://www.openssl.org/docs/)
- [Let's Encrypt](https://letsencrypt.org/)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
