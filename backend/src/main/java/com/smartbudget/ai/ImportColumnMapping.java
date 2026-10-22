package com.smartbudget.ai;

/**
 * Which column of the uploaded file holds what (0-based, null = absent).
 *
 * @param headerRow  1-based number of the row with the column titles, 0 when the file has none
 * @param dateFormat DMY, MDY or YMD: how text dates are written
 * @param descriptionCutAt when set, only the text before its first occurrence is kept from the description cell
 */
public record ImportColumnMapping(
        int headerRow,
        Integer date,
        Integer description,
        Integer amount,
        Integer debit,
        Integer credit,
        Integer type,
        Integer category,
        String dateFormat,
        String descriptionCutAt) {
}
