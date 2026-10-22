package com.smartbudget.category;

import com.smartbudget.common.ApiException;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

@Service
public class CategoryService {

    private final CategoryRepository repository;

    public CategoryService(CategoryRepository repository) {
        this.repository = repository;
    }

    public List<CategoryResponse> list() {
        return repository.findAll(Sort.by("type", "name")).stream().map(CategoryResponse::from).toList();
    }

    public Category getById(String id) {
        return repository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Categoria nu există."));
    }

    public Map<String, Category> getByIds(Collection<String> ids) {
        return repository.findAllById(ids).stream()
                .collect(Collectors.toMap(Category::getId, Function.identity()));
    }
}
