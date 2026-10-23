import { db } from './db';
import { config } from './config';

export interface LiveChatSettings {
  provider: 'auto' | 'tidio' | 'smartsupp' | 'tawkto' | 'custom' | 'off';
  tidioKey: string;
  smartsuppKey: string;
  tawktoPropertyId: string;
  tawktoWidgetId: string;
  tawktoKey: string;
  customScriptUrl: string;
}

export interface ResolvedLiveChat {
  active: boolean;
  provider: 'tidio' | 'smartsupp' | 'tawkto' | 'custom' | 'off';
  scriptUrl: string;
  tidioKey: string;
  smartsuppKey: string;
  tawktoPropertyId: string;
  tawktoWidgetId: string;
  customScriptUrl: string;
  isCustomized: boolean;
}

function cleanTidioKey(val: string): string {
  if (!val) return '';
  const trimmed = val.trim();
  const match = trimmed.match(/(?:code\.tidio\.co\/)?([a-zA-Z0-9_-]+)(?:\.js)?/);
  return match ? match[1] : trimmed;
}

function cleanSmartsuppKey(val: string): string {
  if (!val) return '';
  return val.trim().replace(/^['"]|['"]$/g, '');
}

function parseTawkto(propId: string, widgetId: string, combinedKey: string): { propertyId: string; widgetId: string } {
  let p = (propId || '').trim();
  let w = (widgetId || '').trim();
  const c = (combinedKey || '').trim();

  if (c) {
    const urlMatch = c.match(/embed\.tawk\.to\/([^/?#]+)(?:\/([^/?#]+))?/);
    if (urlMatch) {
      p = urlMatch[1] || p;
      w = urlMatch[2] || w;
    } else if (c.includes('/')) {
      const parts = c.split('/').map(s => s.trim()).filter(Boolean);
      if (parts[0]) p = parts[0];
      if (parts[1]) w = parts[1];
    } else if (!p) {
      p = c;
    }
  }

  if (!w) w = 'default';
  return { propertyId: p, widgetId: w };
}

export function getActiveLiveChat(): ResolvedLiveChat {
  const dbData = db.get<any>('settings', 'livechat')?.data || {};
  const isCustomized = !!db.get<any>('settings', 'livechat');

  const envCfg = config.liveChat || {
    provider: 'auto',
    tidioKey: '',
    smartsuppKey: '',
    tawktoPropertyId: '',
    tawktoWidgetId: 'default',
    tawktoKey: '',
    customScriptUrl: config.brand?.liveChatScript || '',
  };

  const provider = (dbData.provider ?? envCfg.provider ?? 'auto') as LiveChatSettings['provider'];
  const tidioKey = cleanTidioKey(dbData.tidioKey ?? envCfg.tidioKey ?? '');
  const smartsuppKey = cleanSmartsuppKey(dbData.smartsuppKey ?? envCfg.smartsuppKey ?? '');
  const { propertyId: tawktoPropertyId, widgetId: tawktoWidgetId } = parseTawkto(
    dbData.tawktoPropertyId ?? envCfg.tawktoPropertyId ?? '',
    dbData.tawktoWidgetId ?? envCfg.tawktoWidgetId ?? 'default',
    dbData.tawktoKey ?? envCfg.tawktoKey ?? ''
  );
  const customScriptUrl = (dbData.customScriptUrl ?? envCfg.customScriptUrl ?? config.brand?.liveChatScript ?? '').trim();

  let resolvedProvider: 'tidio' | 'smartsupp' | 'tawkto' | 'custom' | 'off' = 'off';

  if (provider === 'off') {
    resolvedProvider = 'off';
  } else if (provider === 'tidio' && tidioKey) {
    resolvedProvider = 'tidio';
  } else if (provider === 'smartsupp' && smartsuppKey) {
    resolvedProvider = 'smartsupp';
  } else if (provider === 'tawkto' && tawktoPropertyId) {
    resolvedProvider = 'tawkto';
  } else if (provider === 'custom' && customScriptUrl) {
    resolvedProvider = 'custom';
  } else if (provider === 'auto') {
    // Priority order for auto-detection: Tidio -> Smartsupp -> Tawkto -> Custom
    if (tidioKey) resolvedProvider = 'tidio';
    else if (smartsuppKey) resolvedProvider = 'smartsupp';
    else if (tawktoPropertyId) resolvedProvider = 'tawkto';
    else if (customScriptUrl) resolvedProvider = 'custom';
  }

  let scriptUrl = '';
  if (resolvedProvider === 'tidio') {
    scriptUrl = `https://code.tidio.co/${tidioKey}.js`;
  } else if (resolvedProvider === 'smartsupp') {
    scriptUrl = 'https://www.smartsuppchat.com/loader.js?';
  } else if (resolvedProvider === 'tawkto') {
    scriptUrl = `https://embed.tawk.to/${tawktoPropertyId}/${tawktoWidgetId}`;
  } else if (resolvedProvider === 'custom') {
    scriptUrl = customScriptUrl;
  }

  return {
    active: resolvedProvider !== 'off' && !!scriptUrl,
    provider: resolvedProvider,
    scriptUrl,
    tidioKey,
    smartsuppKey,
    tawktoPropertyId,
    tawktoWidgetId,
    customScriptUrl,
    isCustomized,
  };
}

export async function saveLiveChatConfig(patch: Partial<LiveChatSettings>): Promise<ResolvedLiveChat> {
  const current = db.get<any>('settings', 'livechat')?.data || {};
  const updated: LiveChatSettings = {
    provider: patch.provider ?? current.provider ?? 'auto',
    tidioKey: patch.tidioKey !== undefined ? patch.tidioKey.trim() : (current.tidioKey || ''),
    smartsuppKey: patch.smartsuppKey !== undefined ? patch.smartsuppKey.trim() : (current.smartsuppKey || ''),
    tawktoPropertyId: patch.tawktoPropertyId !== undefined ? patch.tawktoPropertyId.trim() : (current.tawktoPropertyId || ''),
    tawktoWidgetId: patch.tawktoWidgetId !== undefined ? patch.tawktoWidgetId.trim() : (current.tawktoWidgetId || 'default'),
    tawktoKey: patch.tawktoKey !== undefined ? patch.tawktoKey.trim() : (current.tawktoKey || ''),
    customScriptUrl: patch.customScriptUrl !== undefined ? patch.customScriptUrl.trim() : (current.customScriptUrl || ''),
  };

  await db.put('settings', { id: 'livechat', data: updated });
  return getActiveLiveChat();
}

export async function resetLiveChatConfig(): Promise<ResolvedLiveChat> {
  await db.remove('settings', 'livechat');
  return getActiveLiveChat();
}

export function buildChatScriptHtml(cfg: ResolvedLiveChat): string {
  if (!cfg.active || cfg.provider === 'off') return '';
  const esc = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

  if (cfg.provider === 'tidio') {
    return `\n    <!-- Tidio Live Chat -->\n    <script src="${esc(cfg.scriptUrl)}" async></script>`;
  }

  if (cfg.provider === 'smartsupp') {
    return `\n    <!-- Smartsupp Live Chat -->\n    <script type="text/javascript">\n      var _smartsupp = _smartsupp || {};\n      _smartsupp.key = '${esc(cfg.smartsuppKey)}';\n      window.smartsupp||(function(d) {\n        var s,c,o=smartsupp=function(){ o._.push(arguments)};o._=[];\n        s=d.getElementsByTagName('script')[0];c=d.createElement('script');\n        c.type='text/javascript';c.charset='utf-8';c.async=true;\n        c.src='https://www.smartsuppchat.com/loader.js?';s.parentNode.insertBefore(c,s);\n      })(document);\n    </script>`;
  }

  if (cfg.provider === 'tawkto') {
    return `\n    <!-- Tawk.to Live Chat -->\n    <script type="text/javascript">\n      var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();\n      (function(){\n        var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];\n        s1.async=true;\n        s1.src='${esc(cfg.scriptUrl)}';\n        s1.charset='UTF-8';\n        s1.setAttribute('crossorigin','*');\n        s0.parentNode.insertBefore(s1,s0);\n      })();\n    </script>`;
  }

  if (cfg.provider === 'custom') {
    if (cfg.customScriptUrl.startsWith('<script')) {
      return `\n    <!-- Custom Live Chat -->\n    ${cfg.customScriptUrl}`;
    }
    return `\n    <!-- Custom Live Chat -->\n    <script src="${esc(cfg.customScriptUrl)}" async></script>`;
  }

  return '';
}
