import type { EvenSplitResult, ItemizedSplitResult, TripSplitResult } from './types';
import { formatMoney } from './formatting';

/**
 * Builds clean plain text for Even Split mode.
 */
export function generateEvenSplitShareText(result: EvenSplitResult, currencyCode: string): string {
  const symbol = formatMoney(0, currencyCode).replace(/[0-9.,]/g, '').trim();
  const lines: string[] = [
    `*Bill Split Summary* (${symbol})`,
    '',
    `Original Bill: ${formatMoney(result.billAmountMinor, currencyCode)}`,
    result.taxAmountMinor > 0 ? `Tax: ${formatMoney(result.taxAmountMinor, currencyCode)}` : '',
    result.tipAmountMinor > 0 ? `Tip: ${formatMoney(result.tipAmountMinor, currencyCode)}` : '',
    `Final Total: ${formatMoney(result.finalTotalMinor, currencyCode)}`,
    `Total Participants: ${result.shares.length}`,
    '',
    '*Individual Shares:*'
  ].filter(Boolean);

  for (const s of result.shares) {
    lines.push(`• ${s.name}: ${formatMoney(s.shareMinor, currencyCode)}`);
  }

  lines.push('', 'freexpensetracker.com/bill-splitter/');
  return lines.join('\n');
}

/**
 * Builds clean plain text for Itemized Split mode.
 */
export function generateItemizedSplitShareText(result: ItemizedSplitResult, currencyCode: string): string {
  const symbol = formatMoney(0, currencyCode).replace(/[0-9.,]/g, '').trim();
  const lines: string[] = [
    `*Itemized Bill Split* (${symbol})`,
    '',
    `Items Subtotal: ${formatMoney(result.itemsTotalMinor, currencyCode)}`,
    result.taxAmountMinor > 0 ? `Tax: ${formatMoney(result.taxAmountMinor, currencyCode)}` : '',
    result.tipAmountMinor > 0 ? `Tip: ${formatMoney(result.tipAmountMinor, currencyCode)}` : '',
    `Grand Total: ${formatMoney(result.grandTotalMinor, currencyCode)}`,
    '',
    '*Per Person Breakdown:*'
  ].filter(Boolean);

  for (const p of result.participantBreakdowns) {
    lines.push(`• ${p.name}: ${formatMoney(p.totalMinor, currencyCode)}`);
  }

  lines.push('', 'freexpensetracker.com/bill-splitter/');
  return lines.join('\n');
}

/**
 * Builds clean plain text for Trip / Group Expense Split mode.
 */
export function generateTripSplitShareText(result: TripSplitResult, currencyCode: string, groupTitle: string = 'Trip'): string {
  const symbol = formatMoney(0, currencyCode).replace(/[0-9.,]/g, '').trim();
  const title = groupTitle.trim() || 'Trip';
  const lines: string[] = [
    `*${title} expense split: who pays whom* (${symbol})`,
    ''
  ];

  if (result.settlements.length === 0) {
    lines.push('All balances are fully settled! No payments required.');
  } else {
    for (const s of result.settlements) {
      lines.push(`${s.fromName} → ${s.toName}: ${formatMoney(s.amountMinor, currencyCode)}`);
    }
  }

  lines.push(
    '',
    `Total spent: ${formatMoney(result.totalGroupSpendingMinor, currencyCode)}`,
    `${result.balances.length} participants`,
    '',
    'freexpensetracker.com/bill-splitter/'
  );

  return lines.join('\n');
}

/**
 * Copies text to clipboard with legacy fallback.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {}
  }

  // Fallback for older browsers or insecure contexts
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (_) {
    return false;
  }
}

/**
 * Triggers native Web Share API if available.
 */
export async function shareNative(title: string, text: string): Promise<boolean> {
  if (typeof window !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title,
        text,
        url: 'https://freexpensetracker.com/bill-splitter/'
      });
      return true;
    } catch (_) {
      return false;
    }
  }
  return false;
}

/**
 * Generates direct WhatsApp share link.
 */
export function getWhatsAppShareUrl(text: string): string {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}
