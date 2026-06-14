// js/modules/pwa.js - Gestione PWA e Service Worker

/**
 * Registra il Service Worker - FIX per Vercel
 */
export async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return null;
    try {
        let refreshing = false;
        let waitingWorker = null;
        const banner = document.getElementById('updateBanner');
        const updateButton = document.getElementById('updateAppBtn');
        const showUpdate = worker => {
            waitingWorker = worker;
            banner?.classList.add('visible');
        };

        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
        });
        updateButton?.addEventListener('click', () => {
            if (!waitingWorker) return;
            // Chiede all'app di salvare lo stato corrente e conserva una copia prima del cambio worker.
            window.dispatchEvent(new Event('packlist:before-update'));
            try {
                const currentState = localStorage.getItem('packlist_state');
                if (currentState) localStorage.setItem('packlist_state_backup', currentState);
            } catch (error) {
                console.warn('[PWA] Backup pre-aggiornamento non disponibile:', error);
            }
            updateButton.disabled = true;
            updateButton.textContent = 'Aggiornamento…';
            waitingWorker.postMessage({ type: 'SKIP_WAITING' });
        });

        const registration = await navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' });
        if (registration.waiting) showUpdate(registration.waiting);
        registration.onupdatefound = () => {
            const worker = registration.installing;
            worker?.addEventListener('statechange', () => {
                if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate(worker);
            });
        };
        await registration.update();
        return registration;
    } catch (error) {
        console.error('[PWA] Errore registrazione SW:', error);
        return null;
    }
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
    });

    window.addEventListener('appinstalled', () => {
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
        return false;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

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
