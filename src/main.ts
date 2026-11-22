import './style.css';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { PawTypeEngine, type KeyboardOrientation } from './catEngine';
import { catAudio } from './audio';
import { DEFAULT_BUILTIN_CATS, type CatSkinConfig } from './catSkins';
import type { KeyboardLayoutId } from './keyboardLayout';

interface AppSettings {
  x: number | null;
  y: number | null;
  scale: number;
  alwaysOnTop: boolean;
  clickThroughLocked: boolean;
  showKeyBubbles: boolean;
  soundEnabled: boolean;
  autostart: boolean;
  catBreed: string;
  mcpEnabled: boolean;
  mcpPort: number;
  keyboardLayout: KeyboardLayoutId;
  keyboardOrientation: KeyboardOrientation;
  accessibilityGuideSeen: boolean;
  sponsorUnlocked: boolean;
  unlockedPacks: string[];
  lastSeenVersion: string;
}

type InputEvent =
  | { kind: 'keyDown'; vk: number; scan: number; repeat: boolean }
  | { kind: 'keyUp'; vk: number; scan: number }
  | { kind: 'mouseDown'; button: string }
  | { kind: 'mouseUp'; button: string }
  | { kind: 'mouseWheel'; delta: number }
  | { kind: 'mouseMove'; x: number; y: number; nx: number; ny: number };

interface WindowCursorInfo {
  relX: number;
  relY: number;
  insideWindow: boolean;
  overCat: boolean;
}

interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseUrl: string;
  assetName: string | null;
  downloadUrl: string | null;
  assetSha256: string | null;
  assetSize: number | null;
  installKind: string;
  notesSummary: string;
}

interface UpdateProgressEvent {
  stage: string;
  message: string;
  info: UpdateInfo | null;
}

let appVersion = '0.2.1';
let latestUpdateInfo: UpdateInfo | null = null;
let updateBusy = false;
let dismissedVersion: string | null = null;
let toastAutoHideTimer: number | null = null;
let sliderDragging = false;
const isMac =
  /Mac/i.test(navigator.platform) || /Macintosh/i.test(navigator.userAgent);
const XATTR_CMD = 'xattr -cr /Applications/PawType.app';
const FIX_CMDS = `${XATTR_CMD}\n# 然后到「输入监控」「辅助功能」删掉旧 PawType 再重新添加`;

const CAT_PACK: Record<string, string> = {
  worker: 'office',
  coder: 'office',
  slack: 'office',
  kaoyan: 'study',
  gaokao: 'study',
  nightowl: 'night',
  spring: 'festival',
};

const PACK_LABEL: Record<string, string> = {
  office: '打工包',
  study: '学霸包',
  night: '夜猫包',
  festival: '节日包',
};

interface SkinPackStatus {
  sponsorUnlocked: boolean;
  unlockedPacks: string[];
  seasonal: { spring: boolean; gaokao: boolean };
  packs: Array<{ id: string; name: string; cats: string[]; unlocked: boolean }>;
}

let packStatus: SkinPackStatus | null = null;

interface MacInputStatus {
  accessibility: boolean;
  inputMonitoring: boolean;
  tapActive: boolean;
  tapHasKeyboard: boolean;
  hidActive: boolean;
  keyEventsReceived: number;
}

let settings: AppSettings = {
  x: null,
  y: null,
  scale: 1,
  alwaysOnTop: true,
  clickThroughLocked: false,
  showKeyBubbles: true,
  soundEnabled: true,
  autostart: false,
  catBreed: 'black',
  mcpEnabled: true,
  mcpPort: 27420,
  keyboardLayout: '65',
  keyboardOrientation: 'cat',
  accessibilityGuideSeen: false,
  sponsorUnlocked: false,
  unlockedPacks: [],
  lastSeenVersion: '',
};

let catList: CatSkinConfig[] = [...DEFAULT_BUILTIN_CATS];

const canvas = document.getElementById('pet-canvas') as HTMLCanvasElement;
const menuEl = document.getElementById('context-menu') as HTMLDivElement;
const breedPillsEl = document.getElementById('breed-pills') as HTMLDivElement;
const scaleSliderEl = document.getElementById('scale-slider') as HTMLInputElement;
const scaleValueEl = document.getElementById('scale-value') as HTMLButtonElement;
const updateToastEl = document.getElementById('update-toast') as HTMLDivElement;
const updateToastTextEl = document.getElementById('update-toast-text') as HTMLSpanElement;
const btnToastInstallEl = document.getElementById('btn-toast-install') as HTMLButtonElement;
const btnToastOpenEl = document.getElementById('btn-toast-open') as HTMLButtonElement;
const btnToastCloseEl = document.getElementById('btn-toast-close') as HTMLButtonElement;
const engine = new PawTypeEngine(canvas);
const axGuideEl = document.getElementById('ax-guide') as HTMLDivElement;
const sponsorPanelEl = document.getElementById('sponsor-panel') as HTMLDivElement;
const sponsorQrEl = document.getElementById('sponsor-qr') as HTMLImageElement;
const sponsorHintEl = document.getElementById('sponsor-hint') as HTMLParagraphElement;

function setOverlayOpen(open: boolean): void {
  void invoke('set_menu_open', { open });
}

function closeSponsorPanel(): void {
  if (!sponsorPanelEl.classList.contains('hidden')) {
    sponsorPanelEl.classList.add('hidden');
    if (axGuideEl.classList.contains('hidden') && menuEl.classList.contains('hidden')) {
      setOverlayOpen(false);
    }
  }
}

async function refreshPackStatus(): Promise<void> {
  try {
    packStatus = await invoke<SkinPackStatus>('get_skin_pack_status');
  } catch (err) {
    console.error('pack status failed', err);
  }
  renderPackButtons();
}

function renderPackButtons(): void {
  const grid = document.getElementById('pack-grid');
  if (!grid) return;
  const buttons = grid.querySelectorAll<HTMLButtonElement>('.pack-btn');
  for (const btn of buttons) {
    const pack = btn.dataset.pack || '';
    const info = packStatus?.packs.find((p) => p.id === pack);
    const unlocked = Boolean(info?.unlocked || settings.sponsorUnlocked);
    btn.classList.toggle('unlocked', unlocked);
    const seasonal =
      (pack === 'festival' && packStatus?.seasonal.spring) ||
      (pack === 'study' && packStatus?.seasonal.gaokao);
    btn.classList.toggle('seasonal', Boolean(seasonal) && !unlocked);
    if (unlocked) {
      btn.innerHTML = `✓ 已解锁${PACK_LABEL[pack] || pack}<br /><span>${info?.cats?.join(' · ') || ''}</span>`;
    } else if (seasonal) {
      btn.innerHTML = `限时免费体验中<br /><span>也可赞助永久解锁</span>`;
    } else {
      const names: Record<string, string> = {
        office: '打工·码农·摸鱼',
        study: '考研·高考',
        night: '熬夜猫',
        festival: '春节猫',
      };
      btn.innerHTML = `解锁${PACK_LABEL[pack] || pack}<br /><span>${names[pack] || ''}</span>`;
    }
  }
  if (sponsorHintEl) {
    if (settings.sponsorUnlocked) {
      sponsorHintEl.textContent = '已解锁全部皮肤包，感谢支持！';
    } else {
      const n = settings.unlockedPacks?.length || 0;
      sponsorHintEl.textContent =
        n > 0 ? `已解锁 ${n} 个皮肤包；扫码后可继续解锁其它包` : '扫码赞助后，点对应皮肤包解锁';
    }
  }
}

function openSponsorPanel(): void {
  closeContextMenu();
  axGuideEl.classList.add('hidden');
  if (sponsorQrEl) {
    sponsorQrEl.classList.remove('is-missing');
    sponsorQrEl.onerror = () => {
      sponsorQrEl.classList.add('is-missing');
      if (sponsorHintEl) {
        sponsorHintEl.textContent = '收款码尚未放入 public/sponsor-wechat.png';
      }
    };
    sponsorQrEl.onload = () => {
      sponsorQrEl.classList.remove('is-missing');
    };
    sponsorQrEl.src = `/sponsor-wechat.png?t=${Date.now()}`;
  }
  void refreshPackStatus();
  sponsorPanelEl.classList.remove('hidden');
  setOverlayOpen(true);
}

function closeAxGuide(markSeen: boolean): void {
  if (!axGuideEl.classList.contains('hidden')) {
    axGuideEl.classList.add('hidden');
    if (sponsorPanelEl.classList.contains('hidden') && menuEl.classList.contains('hidden')) {
      setOverlayOpen(false);
    }
  }
  if (markSeen && !settings.accessibilityGuideSeen) {
    void applySettingsPatch({ accessibilityGuideSeen: true });
  }
}

function openAxGuide(): void {
  closeContextMenu();
  closeSponsorPanel();
  axGuideEl.classList.remove('hidden');
  setOverlayOpen(true);
}

function isPremiumCat(id: string): boolean {
  return Boolean(CAT_PACK[id]);
}

function isSeasonallyFree(id: string): boolean {
  if (id === 'spring') return Boolean(packStatus?.seasonal.spring);
  if (id === 'gaokao') return Boolean(packStatus?.seasonal.gaokao);
  return false;
}

function canUseCat(id: string): boolean {
  if (!isPremiumCat(id)) return true;
  if (settings.sponsorUnlocked) return true;
  if (isSeasonallyFree(id)) return true;
  const pack = CAT_PACK[id];
  return Boolean(pack && settings.unlockedPacks?.includes(pack));
}

function setDiagItem(id: string, text: string, level: 'ok' | 'bad' | 'warn'): void {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = level;
}

function updatePermissionDiagnostics(st: MacInputStatus): void {
  setDiagItem(
    'diag-listen',
    st.inputMonitoring ? '输入监控：✅ 正常' : '输入监控：❌ 未生效（键盘关键，请删了重加）',
    st.inputMonitoring ? 'ok' : 'bad',
  );
  setDiagItem(
    'diag-ax',
    st.accessibility ? '辅助功能：✅ 正常' : '辅助功能：❌ 未生效（请删了重加）',
    st.accessibility ? 'ok' : 'bad',
  );
  let hookText = '键盘钩子：检测中…';
  let hookLevel: 'ok' | 'bad' | 'warn' = 'warn';
  if (st.tapActive && st.tapHasKeyboard) {
    hookText = `键盘钩子：✅ 运行中（已收键 ${st.keyEventsReceived} 次）`;
    hookLevel = 'ok';
  } else if (st.hidActive) {
    hookText = `键盘钩子：⚠️ 走备用通道（已收键 ${st.keyEventsReceived} 次）`;
    hookLevel = st.keyEventsReceived > 0 ? 'ok' : 'warn';
  } else if (st.inputMonitoring) {
    hookText = '键盘钩子：❌ 已死（权限有，但监听未跑，请重新连接）';
    hookLevel = 'bad';
  } else {
    hookText = '键盘钩子：❌ 未运行（先修输入监控）';
    hookLevel = 'bad';
  }
  setDiagItem('diag-hook', hookText, hookLevel);

  const statusEl = document.getElementById('ax-guide-status');
  const titleEl = document.getElementById('ax-guide-title');
  if (!statusEl) return;
  if (!st.inputMonitoring) {
    statusEl.className = 'panel-text panel-status-bad';
    statusEl.textContent =
      '一句话：到「输入监控」选中 PawType →「-」删除 →「+」重新添加并打开。更新后旧开关常会假开。';
    if (titleEl) titleEl.textContent = '输入监控未生效';
  } else if (!st.accessibility) {
    statusEl.className = 'panel-text panel-status-bad';
    statusEl.textContent = '输入监控已好。请同样在「辅助功能」里删了重加 PawType。';
    if (titleEl) titleEl.textContent = '辅助功能未生效';
  } else if (!st.tapActive && !st.hidActive) {
    statusEl.className = 'panel-text panel-status-bad';
    statusEl.textContent = '权限看起来正常，但键盘钩子已死。请点「重新连接监听」，或完全退出后再开。';
    if (titleEl) titleEl.textContent = '键盘钩子已断开';
  } else {
    statusEl.className = 'panel-text panel-status-ok';
    statusEl.textContent = `权限正常：已收到按键 ${st.keyEventsReceived} 次。若刚更新完，建议确认下方三项都是绿色。`;
    if (titleEl) titleEl.textContent = '键盘权限正常';
  }
}

async function refreshPermissionGuide(force = false): Promise<boolean> {
  if (!isMac) return true;
  try {
    const st = await invoke<MacInputStatus>('get_macos_input_status');
    const ok =
      Boolean(st.inputMonitoring) &&
      (st.tapHasKeyboard || st.hidActive || st.keyEventsReceived > 0 || st.tapActive);
    const hookDead = st.inputMonitoring && st.accessibility && !st.tapActive && !st.hidActive;
    const needsGuide = !st.inputMonitoring || hookDead || force;
    updatePermissionDiagnostics(st);
    if (needsGuide && (!st.inputMonitoring || hookDead || force)) {
      openAxGuide();
      if (!st.inputMonitoring) {
        void invoke('prompt_listen_event_access');
        if (!st.accessibility) void invoke('prompt_accessibility_permission');
      }
      return false;
    }
    if (!force && !axGuideEl.classList.contains('hidden') && st.inputMonitoring && !hookDead) {
      closeAxGuide(true);
    }
    return ok || st.inputMonitoring;
  } catch (err) {
    console.error('permission status failed', err);
    return true;
  }
}

async function maybeShowAccessibilityGuide(): Promise<void> {
  if (!isMac) return;
  const justUpdated = settings.lastSeenVersion !== appVersion;
  if (justUpdated) {
    const titleEl = document.getElementById('ax-guide-title');
    if (titleEl) titleEl.textContent = `已更新到 v${appVersion}，请确认权限`;
    openAxGuide();
    await refreshPermissionGuide(true);
    void applySettingsPatch({ lastSeenVersion: appVersion });
    return;
  }
  await refreshPermissionGuide(false);
}

async function startPermissionWatcher(): Promise<void> {
  if (!isMac) return;
  window.setInterval(() => {
    void refreshPermissionGuide(false);
  }, 4000);
}

function renderBreedPills(): void {
  if (!breedPillsEl) return;
  breedPillsEl.innerHTML = '';
  for (const cat of catList) {
    const btn = document.createElement('button');
    btn.className = 'breed-pill';
    btn.dataset.breed = cat.id;
    const emoji = cat.emoji ? `${cat.emoji} ` : '🐱 ';
    const locked = !canUseCat(cat.id);
    const seasonal = isSeasonallyFree(cat.id);
    btn.textContent = `${locked ? '🔒 ' : emoji}${cat.name}${seasonal && locked === false && isPremiumCat(cat.id) ? '·限时' : ''}`;
    btn.classList.toggle('locked', locked);
    const pack = CAT_PACK[cat.id];
    btn.title = locked
      ? `需解锁${PACK_LABEL[pack] || '皮肤包'}`
      : seasonal
        ? `${cat.name}（限时免费）`
        : cat.name;
    const accent = cat.accentColor || (cat.id === 'ragdoll' ? '#7ac7ff' : '#c8f538');
    btn.style.setProperty('--pill-accent', accent);
    btn.classList.toggle('active', cat.id === settings.catBreed);
    breedPillsEl.appendChild(btn);
  }
  const hint = document.getElementById('sponsor-menu-hint');
  if (hint) {
    if (settings.sponsorUnlocked) hint.textContent = '✓ 全解锁';
    else if ((settings.unlockedPacks?.length || 0) > 0)
      hint.textContent = `✓ ${settings.unlockedPacks.length}包`;
    else hint.textContent = '☕ 皮肤包';
  }
}

function updateScaleSliderVisual(scaleVal: number): void {
  const pctNum = Math.round(Math.max(20, Math.min(150, scaleVal * 100)));
  if (scaleSliderEl) {
    scaleSliderEl.value = String(pctNum);
    const fillPct = ((pctNum - 20) / (150 - 20)) * 100;
    scaleSliderEl.style.setProperty('--pct', `${fillPct.toFixed(1)}%`);
  }
  if (scaleValueEl) {
    scaleValueEl.textContent = `${pctNum}%`;
  }
}

function syncMenuUI(): void {
  const setCheck = (id: string, on: boolean) => {
    const el = document.getElementById(id);
    if (el) el.textContent = on ? '✓' : '';
  };
  setCheck('chk-bubbles', settings.showKeyBubbles);
  setCheck('chk-lock', settings.clickThroughLocked);
  setCheck('chk-sound', settings.soundEnabled);
  setCheck('chk-top', settings.alwaysOnTop);
  setCheck('chk-autostart', settings.autostart);
  setCheck('chk-mcp', settings.mcpEnabled);

  if (!sliderDragging) {
    updateScaleSliderVisual(settings.scale);
  }

  const kbLayout: KeyboardLayoutId = settings.keyboardLayout === '108' ? '108' : '65';
  const kbOrient: KeyboardOrientation = settings.keyboardOrientation === 'viewer' ? 'viewer' : 'cat';
  document.querySelectorAll<HTMLButtonElement>('[data-kblayout]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.kblayout === kbLayout);
  });
  document.querySelectorAll<HTMLButtonElement>('[data-kborient]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.kborient === kbOrient);
  });

  const activeCat = catList.find((c) => c.id === settings.catBreed) ?? catList[0];
  renderBreedPills();

  const headerEl = document.getElementById('menu-header');
  if (headerEl && activeCat) {
    const emoji = activeCat.emoji || '🐱';
    headerEl.textContent = `${emoji} PawType ${activeCat.name}`;
    headerEl.style.color = activeCat.accentColor || '#c8f538';
  }

  engine.showKeyBubbles = settings.showKeyBubbles;
  engine.setCatAppearance(activeCat?.id || 'black', activeCat);
  engine.setKeyboardConfig(kbLayout, kbOrient);
  if (!sliderDragging) {
    engine.setRenderScale(settings.scale);
  }
  catAudio.setEnabled(settings.soundEnabled);
}

function closeContextMenu(): void {
  if (!menuEl.classList.contains('hidden')) {
    menuEl.classList.add('hidden');
    void invoke('set_menu_open', { open: false });
  }
}

function openContextMenu(clientX: number, clientY: number): void {
  syncMenuUI();
  menuEl.classList.remove('hidden');
  void invoke('set_menu_open', { open: true });

  const rect = menuEl.getBoundingClientRect();
  const maxX = Math.max(8, window.innerWidth - rect.width - 8);
  const maxY = Math.max(8, window.innerHeight - rect.height - 8);
  menuEl.style.left = `${Math.max(8, Math.min(clientX, maxX))}px`;
  menuEl.style.top = `${Math.max(8, Math.min(clientY, maxY))}px`;
}

async function applySettingsPatch(patch: Partial<AppSettings>): Promise<void> {
  settings = { ...settings, ...patch };
  syncMenuUI();
  settings = await invoke<AppSettings>('update_settings', { patch: settings });
  syncMenuUI();
}

async function copyMcpConfig(): Promise<void> {
  const hint = document.getElementById('mcp-copy-hint');
  try {
    const jsonText = await invoke<string>('get_mcp_config');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(jsonText);
    } else {
      const ta = document.createElement('textarea');
      ta.value = jsonText;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    if (hint) {
      hint.textContent = '✓ 已复制';
      hint.classList.add('copied');
      setTimeout(() => {
        hint.textContent = 'AI 捏猫';
        hint.classList.remove('copied');
      }, 1800);
    }
  } catch (err) {
    console.error('Failed to copy MCP config:', err);
  }
}

async function createDesktopShortcut(): Promise<void> {
  const hint = document.getElementById('shortcut-hint');
  try {
    await invoke<string>('create_desktop_shortcut');
    if (hint) {
      hint.textContent = '✓ 已创建';
      hint.classList.add('copied');
      setTimeout(() => {
        hint.textContent = 'PawType';
        hint.classList.remove('copied');
      }, 1800);
    }
  } catch (err) {
    console.error('Failed to create desktop shortcut:', err);
  }
}

function setUpdateHint(text: string, mode: 'default' | 'ready' | 'error' = 'default'): void {
  const hint = document.getElementById('update-hint');
  if (!hint) return;
  hint.textContent = text;
  hint.classList.remove('update-ready', 'update-error');
  if (mode === 'ready') hint.classList.add('update-ready');
  else if (mode === 'error') hint.classList.add('update-error');
}

function hideUpdateToast(): void {
  if (toastAutoHideTimer !== null) {
    window.clearTimeout(toastAutoHideTimer);
    toastAutoHideTimer = null;
  }
  if (!updateToastEl.classList.contains('hidden')) {
    updateToastEl.classList.add('hidden');
    void invoke('set_update_banner_open', { open: false });
  }
}

function showUpdateToast(
  text: string,
  options: { showInstall?: boolean; showOpen?: boolean; autoHideMs?: number; busy?: boolean } = {},
): void {
  if (toastAutoHideTimer !== null) {
    window.clearTimeout(toastAutoHideTimer);
    toastAutoHideTimer = null;
  }
  updateToastTextEl.textContent = text;
  btnToastInstallEl.classList.toggle('hidden', !options.showInstall);
  btnToastInstallEl.disabled = Boolean(options.busy);
  btnToastOpenEl.classList.toggle('hidden', !options.showOpen);
  updateToastEl.classList.remove('hidden');
  void invoke('set_update_banner_open', { open: true });

  if (options.autoHideMs && options.autoHideMs > 0) {
    toastAutoHideTimer = window.setTimeout(() => {
      hideUpdateToast();
    }, options.autoHideMs);
  }
}

function handleUpdateProgressEvent(ev: UpdateProgressEvent, fromManual = false): void {
  if (ev.info) {
    latestUpdateInfo = ev.info;
    appVersion = ev.info.currentVersion || appVersion;
  }

  switch (ev.stage) {
    case 'checking':
      updateBusy = true;
      setUpdateHint('检测中...');
      showUpdateToast('🔍 正在检查新版本...', { busy: true });
      break;
    case 'available':
      updateBusy = false;
      if (latestUpdateInfo?.hasUpdate) {
        const ver = latestUpdateInfo.latestVersion;
        setUpdateHint(`⬆ v${ver}`, 'ready');
        if (fromManual || dismissedVersion !== ver) {
          showUpdateToast(`✨ 发现新版本 v${ver}`, {
            showInstall: Boolean(latestUpdateInfo.downloadUrl),
            showOpen: !latestUpdateInfo.downloadUrl,
          });
        }
      }
      break;
    case 'up_to_date':
      updateBusy = false;
      setUpdateHint(`✓ v${appVersion}`);
      showUpdateToast(`✓ 已是最新版本 v${appVersion}`, { autoHideMs: 2600 });
      break;
    case 'downloading':
    case 'verifying':
    case 'installing':
      updateBusy = true;
      setUpdateHint('更新中...', 'ready');
      showUpdateToast(`⏳ ${ev.message}`, { busy: true });
      break;
    case 'error':
      updateBusy = false;
      setUpdateHint('检查失败', 'error');
      showUpdateToast(`⚠ ${ev.message}`, {
        showOpen: true,
        autoHideMs: 5200,
      });
      break;
  }
}

async function triggerInstallUpdate(): Promise<void> {
  if (updateBusy || !latestUpdateInfo || !latestUpdateInfo.hasUpdate) return;
  updateBusy = true;
  closeContextMenu();
  showUpdateToast(`⏳ 正在下载 v${latestUpdateInfo.latestVersion}...`, { busy: true });
  setUpdateHint('下载中...', 'ready');
  try {
    await invoke('install_update', { info: latestUpdateInfo });
  } catch (err) {
    updateBusy = false;
    const msg = typeof err === 'string' ? err : String(err);
    setUpdateHint('更新失败', 'error');
    showUpdateToast(`⚠ ${msg}`, { showOpen: true, autoHideMs: 6500 });
  }
}

async function triggerManualUpdateCheck(): Promise<void> {
  if (updateBusy) return;
  // If we already know an update is ready, clicking the menu item immediately starts installing it!
  if (latestUpdateInfo?.hasUpdate && latestUpdateInfo.downloadUrl) {
    await triggerInstallUpdate();
    return;
  }
  updateBusy = true;
  setUpdateHint('检测中...');
  closeContextMenu();
  showUpdateToast('🔍 正在检查新版本...', { busy: true });
  try {
    const info = await invoke<UpdateInfo>('check_for_update');
    handleUpdateProgressEvent(
      {
        stage: info.hasUpdate ? 'available' : 'up_to_date',
        message: info.hasUpdate
          ? `发现新版本 v${info.latestVersion}`
          : `已是最新版本 v${info.currentVersion}`,
        info,
      },
      true,
    );
  } catch (err) {
    const msg = typeof err === 'string' ? err : String(err);
    handleUpdateProgressEvent({ stage: 'error', message: msg, info: null }, true);
  }
}

async function bootstrap(): Promise<void> {
  engine.start();

  // Hide Windows-only desktop shortcut button on macOS
  if (isMac) {
    const shortcutBtn = document.getElementById('btn-desktop-shortcut');
    if (shortcutBtn) shortcutBtn.style.display = 'none';
  } else {
    const permBtn = document.getElementById('btn-perm-guide');
    if (permBtn) permBtn.style.display = 'none';
  }

  try {
    const [loadedSettings, loadedCats, loadedVer] = await Promise.all([
      invoke<AppSettings>('get_settings'),
      invoke<CatSkinConfig[]>('get_cats'),
      invoke<string>('get_app_version'),
    ]);
    settings = loadedSettings;
    if (Array.isArray(loadedCats) && loadedCats.length > 0) {
      catList = loadedCats;
    }
    if (loadedVer) {
      appVersion = loadedVer;
      setUpdateHint(`v${appVersion}`);
    }
    if (!Array.isArray(settings.unlockedPacks)) settings.unlockedPacks = [];
    if (typeof settings.lastSeenVersion !== 'string') settings.lastSeenVersion = '';
    await refreshPackStatus();
    syncMenuUI();
    await maybeShowAccessibilityGuide();
    void startPermissionWatcher();
  } catch (err) {
    console.error('Failed to load settings or cats:', err);
  }

  document.getElementById('btn-ax-open')?.addEventListener('click', (e) => {
    e.stopPropagation();
    void invoke('open_accessibility_settings');
    void invoke('prompt_accessibility_permission');
  });
  document.getElementById('btn-input-monitor-open')?.addEventListener('click', (e) => {
    e.stopPropagation();
    void invoke('open_input_monitoring_settings');
    void invoke('prompt_listen_event_access');
  });
  document.getElementById('btn-ax-recheck')?.addEventListener('click', (e) => {
    e.stopPropagation();
    void refreshPermissionGuide(true);
  });
  document.getElementById('btn-ax-reconnect')?.addEventListener('click', (e) => {
    e.stopPropagation();
    void invoke('reconnect_macos_input');
    void refreshPermissionGuide(true);
  });
  document.getElementById('btn-ax-copy-xattr')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(FIX_CMDS);
      const statusEl = document.getElementById('ax-guide-status');
      if (statusEl) {
        statusEl.textContent = '已复制修复命令，可粘贴到「终端」执行。';
        statusEl.className = 'panel-text panel-status-ok';
      }
    } catch (err) {
      console.error(err);
    }
  });
  document.getElementById('btn-ax-later')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeAxGuide(true);
  });
  document.getElementById('pack-grid')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.pack-btn') as HTMLButtonElement | null;
    if (!btn) return;
    e.stopPropagation();
    const pack = btn.dataset.pack;
    if (!pack) return;
    void invoke<AppSettings>('unlock_skin_pack', { pack }).then(async (next) => {
      settings = next;
      await refreshPackStatus();
      syncMenuUI();
    });
  });
  document.getElementById('btn-sponsor-unlock')?.addEventListener('click', (e) => {
    e.stopPropagation();
    void invoke<AppSettings>('unlock_skin_pack', { pack: 'all' }).then(async (next) => {
      settings = next;
      await refreshPackStatus();
      syncMenuUI();
    });
  });
  document.getElementById('btn-sponsor-close')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeSponsorPanel();
  });

  await listen('paw-open-sponsor', () => {
    openSponsorPanel();
  });

  await listen<UpdateProgressEvent>('paw-update-status', (ev) => {
    handleUpdateProgressEvent(ev.payload, false);
  });

  btnToastInstallEl.addEventListener('click', (e) => {
    e.stopPropagation();
    void triggerInstallUpdate();
  });

  btnToastOpenEl.addEventListener('click', (e) => {
    e.stopPropagation();
    const url = latestUpdateInfo?.releaseUrl || 'https://github.com/XiaobenkangDD/pawtype/releases/latest';
    void invoke('open_release_page', { url });
  });

  btnToastCloseEl.addEventListener('click', (e) => {
    e.stopPropagation();
    if (latestUpdateInfo?.hasUpdate) {
      dismissedVersion = latestUpdateInfo.latestVersion;
    }
    hideUpdateToast();
  });

  if (scaleSliderEl) {
    scaleSliderEl.addEventListener('pointerdown', () => {
      sliderDragging = true;
    });
    scaleSliderEl.addEventListener('input', () => {
      sliderDragging = true;
      const nextScale = Math.max(0.2, Math.min(1.5, Number(scaleSliderEl.value) / 100));
      updateScaleSliderVisual(nextScale);
      engine.setRenderScale(nextScale);
    });
    const commitSliderScale = () => {
      sliderDragging = false;
      const nextScale = Math.max(0.2, Math.min(1.5, Number(scaleSliderEl.value) / 100));
      void applySettingsPatch({ scale: nextScale });
    };
    scaleSliderEl.addEventListener('change', commitSliderScale);
    scaleSliderEl.addEventListener('pointerup', () => {
      sliderDragging = false;
    });
  }

  if (scaleValueEl) {
    scaleValueEl.addEventListener('click', (e) => {
      e.stopPropagation();
      sliderDragging = false;
      updateScaleSliderVisual(1.0);
      void applySettingsPatch({ scale: 1.0 });
    });
  }

  await listen<AppSettings>('paw-settings', (ev) => {
    settings = ev.payload;
    if (!Array.isArray(settings.unlockedPacks)) settings.unlockedPacks = [];
    void refreshPackStatus();
    syncMenuUI();
  });

  await listen<CatSkinConfig[]>('paw-cats', (ev) => {
    if (Array.isArray(ev.payload) && ev.payload.length > 0) {
      catList = ev.payload;
      syncMenuUI();
    }
  });

  await listen<InputEvent>('paw-input', (ev) => {
    const p = ev.payload;
    switch (p.kind) {
      case 'keyDown':
        engine.onKeyDown(p.vk, p.repeat);
        break;
      case 'keyUp':
        engine.onKeyUp(p.vk);
        break;
      case 'mouseMove':
        engine.onGlobalMouseMove(p.nx, p.ny);
        break;
      case 'mouseDown':
        engine.onMouseDown(p.button);
        break;
      case 'mouseUp':
        engine.onMouseUp(p.button);
        break;
      case 'mouseWheel':
        engine.onMouseWheel();
        break;
    }
  });

  await listen<WindowCursorInfo>('paw-cursor', (ev) => {
    const c = ev.payload;
    engine.onWindowCursor(c.relX, c.relY, c.overCat);
    canvas.classList.toggle('pet-hover', c.overCat && !settings.clickThroughLocked);
  });

  // Left-click drag to reposition transparent window
  canvas.addEventListener('mousedown', async (e) => {
    if (e.button === 0) {
      closeContextMenu();
      if (settings.clickThroughLocked) return;
      canvas.classList.add('pet-dragging');
      void invoke('set_dragging', { dragging: true });
      try {
        await getCurrentWindow().startDragging();
      } finally {
        canvas.classList.remove('pet-dragging');
        void invoke('set_dragging', { dragging: false });
        void invoke('save_window_pos');
      }
    }
  });

  // Right-click opens sleek dark glass settings menu
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (settings.clickThroughLocked) return;
    openContextMenu(e.clientX, e.clientY);
  });

  window.addEventListener('blur', () => closeContextMenu());
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeContextMenu();
      closeSponsorPanel();
      closeAxGuide(false);
    }
  });

  menuEl.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>(
      '[data-action], [data-scale], [data-breed], [data-kblayout], [data-kborient]',
    );
    if (!target) return;

    const kbLayoutAttr = target.dataset.kblayout;
    if (kbLayoutAttr === '65' || kbLayoutAttr === '108') {
      void applySettingsPatch({ keyboardLayout: kbLayoutAttr });
      closeContextMenu();
      return;
    }

    const kbOrientAttr = target.dataset.kborient;
    if (kbOrientAttr === 'cat' || kbOrientAttr === 'viewer') {
      void applySettingsPatch({ keyboardOrientation: kbOrientAttr });
      closeContextMenu();
      return;
    }

    const breedAttr = target.dataset.breed;
    if (breedAttr) {
      if (!canUseCat(breedAttr)) {
        closeContextMenu();
        openSponsorPanel();
        return;
      }
      void applySettingsPatch({ catBreed: breedAttr });
      closeContextMenu();
      return;
    }

    const scaleAttr = target.dataset.scale;
    if (scaleAttr) {
      void applySettingsPatch({ scale: Number(scaleAttr) });
      closeContextMenu();
      return;
    }

    switch (target.dataset.action) {
      case 'toggle-bubbles':
        void applySettingsPatch({ showKeyBubbles: !settings.showKeyBubbles });
        break;
      case 'toggle-lock':
        void applySettingsPatch({ clickThroughLocked: !settings.clickThroughLocked });
        closeContextMenu();
        break;
      case 'toggle-sound':
        void applySettingsPatch({ soundEnabled: !settings.soundEnabled });
        break;
      case 'toggle-top':
        void applySettingsPatch({ alwaysOnTop: !settings.alwaysOnTop });
        break;
      case 'toggle-autostart':
        void applySettingsPatch({ autostart: !settings.autostart });
        break;
      case 'toggle-mcp':
        void applySettingsPatch({ mcpEnabled: !settings.mcpEnabled });
        break;
      case 'copy-mcp':
        void copyMcpConfig();
        break;
      case 'desktop-shortcut':
        void createDesktopShortcut();
        break;
      case 'check-update':
        void triggerManualUpdateCheck();
        break;
      case 'sponsor':
        openSponsorPanel();
        break;
      case 'perm-guide':
        closeContextMenu();
        void refreshPermissionGuide(true);
        openAxGuide();
        break;
      case 'reset-pos':
        void invoke('reset_position');
        closeContextMenu();
        break;
      case 'quit':
        void invoke('quit_app');
        break;
    }
  });
}

void bootstrap();
