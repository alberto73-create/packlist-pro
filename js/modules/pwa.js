// js/modules/pwa.js - Gestione PWA e Service Worker

/**
 * Registra il Service Worker
 */
export async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('./sw.js');
            console.log('[PWA] Service Worker registrato:', registration.scope);
            return registration;
        } catch (error) {
            console.error('[PWA] Errore registrazione SW:', error);
            return null;
        }
    }
    return null;
}

/**
 * Setup del prompt di installazione
 */
let deferredPrompt = null;

export function setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        showInstallBanner(true);
        console.log('[PWA] Prompt di installazione pronto');
    });

    window.addEventListener('appinstalled', () => {
        console.log('[PWA] App installata con successo');
        deferredPrompt = null;
        hideInstallBanner();
    });
}

/**
 * Mostra il banner di installazione
 */
export function showInstallBanner(show) {
    const banner = document.getElementById('installBanner');
    if (banner) {
        if (show) {
            banner.classList.add('visible');
        } else {
            banner.classList.remove('visible');
        }
    }
}

/**
 * Nasconde il banner di installazione
 */
export function hideInstallBanner() {
    showInstallBanner(false);
}

/**
 * Triggera l'installazione dell'app
 */
export async function triggerInstall() {
    if (!deferredPrompt) {
        console.log('[PWA] Nessun prompt disponibile');
        return false;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    console.log(`[PWA] Scelta utente: ${outcome}`);
    
    if (outcome === 'accepted') {
        console.log('[PWA] Utente ha accettato l\'installazione');
    }
    
    deferredPrompt = null;
    hideInstallBanner();
    
    return outcome === 'accepted';
}

/**
 * Dismiss del banner di installazione
 */
export function dismissInstallBanner() {
    hideInstallBanner();
    localStorage.setItem('packlist_install_dismissed', 'true');
}

/**
 * Controlla se il banner è stato dismissato
 */
export function isInstallBannerDismissed() {
    return localStorage.getItem('packlist_install_dismissed') === 'true';
}

/**
 * Gestisce lo stato online/offline
 */
export function setupOnlineOfflineHandlers() {
    const offlineBar = document.getElementById('offlineBar');
    
    function updateOnlineStatus() {
        if (offlineBar) {
            if (navigator.onLine) {
                offlineBar.style.display = 'none';
            } else {
                offlineBar.style.display = 'block';
            }
        }
    }

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // Check iniziale
    updateOnlineStatus();
}

/**
 * Verifica supporto PWA
 */
export function checkPWASupport() {
    return {
        serviceWorker: 'serviceWorker' in navigator,
        beforeInstallPrompt: false, // Verrà settato dall'evento
        standalone: window.matchMedia('(display-mode: standalone)').matches
    };
}
