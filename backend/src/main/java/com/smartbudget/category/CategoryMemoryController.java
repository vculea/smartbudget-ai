package com.smartbudget.category;

import com.smartbudget.transaction.TransactionType;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/category-memory")
@Tag(name = "Category memory")
public class CategoryMemoryController {

    private final CategoryMemoryService service;

    public CategoryMemoryController(CategoryMemoryService service) {
        this.service = service;
    }

    @PostMapping("/match")
    @Operation(summary = "Categories remembered from the user's earlier choices for imported descriptions",
            description = "Max 1000 items. categoryId is null when the merchant is unknown or used with several "
                    + "categories.")
    public CategoryMemoryMatchResponse match(@Valid @RequestBody CategoryMemoryMatchRequest request) {
        return service.match(request.items());
    }

    @PostMapping("/learn")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Remember the categories the user kept when saving an import",
            description = "corrected=true replaces what was remembered for the merchant. Entries with an unknown "
                    + "category or a category of the other type are ignored.")
    public void learn(@Valid @RequestBody CategoryMemoryLearnRequest request) {
        service.learn(request.entries());
    }

    @GetMapping
    @Operation(summary = "List the merchants the app remembers, most recent first")
    public List<CategoryMemoryEntryResponse> entries() {
        return service.entries();
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Forget one merchant")
    public void forget(@RequestParam TransactionType type, @RequestParam String key) {
        service.forget(type, key);
    }

    @DeleteMapping("/all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Forget every remembered merchant")
    public void forgetAll() {
        service.forgetAll();
    }
}
