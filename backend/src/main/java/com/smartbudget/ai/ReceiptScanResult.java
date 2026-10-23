package com.smartbudget.ai;

import java.util.List;

/**
 * The transactions found in one photo: a receipt or invoice gives one, a bank statement or a list of card
 * payments may give several. Never empty.
 */
public record ReceiptScanResult(List<ReceiptScan> transactions) {

    public ReceiptScanResult {
        transactions = List.copyOf(transactions);
    }
}
