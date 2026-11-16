package com.smartbudget.ai;

import com.smartbudget.category.CategoryMemoryMatchResponse;
import com.smartbudget.category.CategoryMemoryMatchRequest;
import com.smartbudget.category.CategoryMemoryService;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/** Applies clear remembered merchant categories to receipt scan results. */
@Component
public class ReceiptScanCategoryMemory {

    private final CategoryMemoryService categoryMemory;

    public ReceiptScanCategoryMemory(CategoryMemoryService categoryMemory) {
        this.categoryMemory = categoryMemory;
    }

    public ReceiptScanResult apply(ReceiptScanResult result) {
        if (result.transactions().isEmpty()) {
            return result;
        }

        List<CategoryMemoryMatchRequest.Item> items = new ArrayList<>(result.transactions().size());
        for (int i = 0; i < result.transactions().size(); i++) {
            ReceiptScan scan = result.transactions().get(i);
            items.add(new CategoryMemoryMatchRequest.Item(i, scan.description(), scan.type()));
        }

        Map<Integer, String> remembered = new HashMap<>();
        CategoryMemoryMatchResponse matches = categoryMemory.match(items);
        for (CategoryMemoryMatchResponse.Suggestion suggestion : matches.suggestions()) {
            if (suggestion.categoryId() != null) {
                remembered.put(suggestion.index(), suggestion.categoryId());
            }
        }
        if (remembered.isEmpty()) {
            return result;
        }

        List<ReceiptScan> transactions = new ArrayList<>(result.transactions().size());
        for (int i = 0; i < result.transactions().size(); i++) {
            ReceiptScan scan = result.transactions().get(i);
            String categoryId = remembered.getOrDefault(i, scan.categoryId());
            transactions.add(new ReceiptScan(scan.type(), scan.amount(), scan.description(),
                    scan.transactionDate(), categoryId));
        }
        return new ReceiptScanResult(transactions);
    }
}
