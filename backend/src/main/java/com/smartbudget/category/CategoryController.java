package com.smartbudget.category;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/categories")
@Tag(name = "Categories")
public class CategoryController {

    private final CategoryService service;

    public CategoryController(CategoryService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "List the current user's income and expense categories")
    public List<CategoryResponse> list() {
        return service.list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create a category", description = "Names are unique per type (case-insensitive); 409 otherwise.")
    public CategoryResponse create(@Valid @RequestBody CategoryRequest request) {
        return service.create(request);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Rename or recolor a category",
            description = "The type can change only while no transaction or budget uses the category (409).")
    public CategoryResponse update(@PathVariable String id, @Valid @RequestBody CategoryRequest request) {
        return service.update(id, request);
    }

    @GetMapping("/{id}/usage")
    @Operation(summary = "Count the transactions and budgets that use a category")
    public CategoryUsageResponse usage(@PathVariable String id) {
        return service.usage(id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete a category",
            description = "When the category is in use, replacementId (same type) is required: its transactions and "
                    + "budgets move there (409 without it). A budget whose month already has one for the "
                    + "replacement is removed.")
    public void delete(@PathVariable String id, @RequestParam(required = false) String replacementId) {
        service.delete(id, replacementId);
    }
}
