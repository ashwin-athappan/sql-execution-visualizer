import { BTreeKey } from './types';

/** Insert key into a sorted array in-place, return the insertion index */
export function insertSorted(arr: BTreeKey[], key: BTreeKey): number {
    let lo = 0, hi = arr.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (arr[mid] < key) lo = mid + 1;
        else hi = mid;
    }
    arr.splice(lo, 0, key);
    return lo;
}

/** Remove the first occurrence of key from arr */
export function removeFromArray<T>(arr: T[], val: T): void {
    const idx = arr.indexOf(val);
    if (idx !== -1) arr.splice(idx, 1);
}

/** Find first index where arr[i] >= key */
export function lowerBound(arr: BTreeKey[], key: BTreeKey): number {
    let lo = 0, hi = arr.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (arr[mid] < key) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}

/**
 * Return the index of the child to follow when searching or inserting key
 * into an internal node. Equivalent to "first i where keys[i] > key".
 */
export function findChildIndex(keys: BTreeKey[], key: BTreeKey): number {
    let i = 0;
    while (i < keys.length && key >= keys[i]) i++;
    return i;
}