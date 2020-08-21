import Ion from '../Ion';
import IONKEYS from '../../IONKEYS';
import {request} from '../Network';

const EVENT_VISIBILITY_CHANGE = 'visibilitychange';

const STATE_HIDDEN = 'hidden';
const STATE_VISIBLE = 'visible';

// See if we should refresh the page every 30 minutes
const REFRESH_TIMEOUT = 1800000;

/**
 * Get stored git hash, or if there is none then fetch the remote git hash and save it in Ion
 */
const getStoredVersionAsync = async () => {
    const storedVersion = await Ion.get(IONKEYS.APP_VERSION_HASH);
    if (!storedVersion) {
        // only get the remote version if there is no version locally stored
        const remoteVersion = await request(CONST.COMMAND.GET_VERSION_HASH);
        Ion.set(IONKEYS.APP_VERSION_HASH, remoteVersion);
    }
};

/**
 * Fetch the remote git hash, and compare it to the one stored in Ion.
 *
 * If they are the same, save the updated version in Ion.
 * Else, set app_shouldRefresh = true in Ion
 */
const appShouldRefreshAsync = async () => {
    const storedVersion = await Ion.get(IONKEYS.APP_VERSION_HASH);

    // If the app is offline, this request will hang indefinitely.
    // But that's okay, because it couldn't possibly refresh anyways.
    const remoteVersion = await request(CONST.COMMAND.GET_VERSION_HASH);

    if (storedVersion === remoteVersion) {
        if (!storedVersion) {
            await Ion.set(IONKEYS.APP_VERSION_HASH, remoteVersion);
        }
    } else {
        await Ion.set(IONKEYS.APP_SHOULD_REFRESH, true);
    }
};

/**
 * Resets the timer to periodically check if the app should refresh.
 * If the app is hidden, refresh.
 * If the app is visible, prompt the user to refresh.
 */
const resetTimerAndMaybeRefresh = async () => {
    // Reset timeout
    const timer = Ion.get(IONKEYS.REFRESHER_TIMER);
    clearInterval(timer);
    setInterval(appShouldRefreshAsync, REFRESH_TIMEOUT);

    // Compare hashes and update Ion app_shouldRefresh
    appShouldRefreshAsync();

    if (document.visibilityState === STATE_HIDDEN) {
        window.location.reload();
    } else if (document.visibilityState === STATE_VISIBLE) {
        // TODO: Notify user in a less invasive way that they should refresh the page (i.e: Growl)
        if (window.confirm('Refresh the page to get the latest updates!')) {
            window.location.reload(true);
        }
    }
};

/**
 * 1) Initialize shouldRefresh to false
 * 2) Get the stored version hash, or if there is none saved, fetch remote hash and save it.
 * 3) Periodically check if app should refresh
 * 4) Additionally, check if app should refresh when its visibility changes.
 */
const init = async () => {
    Ion.set(IONKEYS.APP_SHOULD_REFRESH, false);

    // When the page first loads, get the current version hash
    getStoredVersionAsync();

    // Check periodically if we should refresh the app
    Ion.set(IONKEYS.REFRESHER_TIMER, setInterval(appShouldRefreshAsync, REFRESH_TIMEOUT));

    window.addEventListener(EVENT_VISIBILITY_CHANGE, resetTimerAndMaybeRefresh);
};

export default init;
