package com.smartbudget.ai;

/** What the browser sends, together with the receipt image, to the user's local vision model. */
public record LocalReceiptPrompt(String systemPrompt, String userText) {
}
