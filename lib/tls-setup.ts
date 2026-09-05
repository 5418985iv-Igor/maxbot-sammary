import fs from 'fs';
import path from 'path';
import https from 'https';
import { Agent, setGlobalDispatcher } from 'undici';

let isConfigured = false;

/**
 * Clean PEM certificate content by removing non-base64 comment lines inside BEGIN/END blocks
 */
function cleanPemCert(content: string): string {
  const lines = content.split(/\r?\n/);
  const cleaned: string[] = [];
  let inside = false;
  for (const line of lines) {
    if (line.includes('-----BEGIN CERTIFICATE-----')) {
      inside = true;
      cleaned.push(line);
      continue;
    }
    if (line.includes('-----END CERTIFICATE-----')) {
      inside = false;
      cleaned.push(line);
      continue;
    }
    if (inside) {
      const sanitizedLine = line.replace(/[^a-zA-Z0-9+/=]/g, '');
      if (sanitizedLine.length > 0) {
        cleaned.push(sanitizedLine);
      }
    } else {
      cleaned.push(line);
    }
  }
  return cleaned.join('\n');
}

/**
 * Configure Node.js TLS and undici fetch to trust Russian trusted CA certificates
 * located in /certs/russian_trusted_root_ca.crt and /certs/russian_trusted_sub_ca.crt.
 * This fixes "unable to get local issuer certificate" errors on VDS or external servers.
 */
export function configureTrustedCerts() {
  if (isConfigured) return;
  isConfigured = true;

  try {
    const certsDir = path.join(process.cwd(), 'certs');
    const rootCaPath = path.join(certsDir, 'russian_trusted_root_ca.crt');
    const subCaPath = path.join(certsDir, 'russian_trusted_sub_ca.crt');

    const caCerts: (string | Buffer)[] = [];

    if (fs.existsSync(rootCaPath)) {
      try {
        const raw = fs.readFileSync(rootCaPath, 'utf8');
        const cleaned = cleanPemCert(raw);
        caCerts.push(cleaned);
        console.log('[TLS-SETUP] Loaded and sanitized root CA from:', rootCaPath);
      } catch (err) {
        console.error('[TLS-SETUP] Error reading root CA:', err);
      }
    } else {
      console.warn('[TLS-SETUP] Root CA not found at:', rootCaPath);
    }

    if (fs.existsSync(subCaPath)) {
      try {
        const raw = fs.readFileSync(subCaPath, 'utf8');
        const cleaned = cleanPemCert(raw);
        caCerts.push(cleaned);
        console.log('[TLS-SETUP] Loaded and sanitized sub CA from:', subCaPath);
      } catch (err) {
        console.error('[TLS-SETUP] Error reading sub CA:', err);
      }
    } else {
      console.warn('[TLS-SETUP] Sub CA not found at:', subCaPath);
    }

    if (caCerts.length > 0) {
      // 1. Set NODE_EXTRA_CA_CERTS if root CA exists
      if (!process.env.NODE_EXTRA_CA_CERTS && fs.existsSync(rootCaPath)) {
        process.env.NODE_EXTRA_CA_CERTS = rootCaPath;
      }

      // 2. Configure Node.js https global agent
      try {
        const existingCa = https.globalAgent.options.ca;
        if (existingCa) {
          if (Array.isArray(existingCa)) {
            https.globalAgent.options.ca = [...existingCa, ...caCerts];
          } else {
            https.globalAgent.options.ca = [existingCa, ...caCerts];
          }
        } else {
          https.globalAgent.options.ca = caCerts;
        }
      } catch (err) {
        console.error('[TLS-SETUP] Error setting https.globalAgent.options.ca:', err);
      }

      // 3. Configure undici Agent for global fetch()
      try {
        const agent = new Agent({
          connect: {
            ca: caCerts,
            rejectUnauthorized: false,
          },
        });
        setGlobalDispatcher(agent);
        console.log('[TLS-SETUP] Undici global dispatcher configured with Russian trusted CA certificates (rejectUnauthorized: false).');
      } catch (err) {
        console.error('[TLS-SETUP] Error configuring undici Agent:', err);
      }
    } else {
      console.warn('[TLS-SETUP] No CA certificate files found in /certs directory, configuring fallback undici agent.');
      try {
        const agent = new Agent({
          connect: {
            rejectUnauthorized: false,
          },
        });
        setGlobalDispatcher(agent);
        console.log('[TLS-SETUP] Undici fallback dispatcher configured (rejectUnauthorized: false).');
      } catch (err) {
        console.error('[TLS-SETUP] Error configuring fallback undici Agent:', err);
      }
    }
  } catch (err) {
    console.error('[TLS-SETUP] Failed to configure trusted certificates:', err);
  }
}
