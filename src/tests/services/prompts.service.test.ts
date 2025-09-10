import {
    getTranslatePrompt,
    getGrammarAnalysisPrompt,
    getVocabularyExpansionPrompt,
    getContextNuancePrompt,
    getCreativePracticePrompt,
    getPronunciationAnalysisPrompt
} from '../../services/prompts.service';

describe('Prompts Service', () => {
    const sentence = "I love programming";
    const langGeneral = "English";

    it('should generate translate prompt with sentence and language', () => {
        const result = getTranslatePrompt(sentence, langGeneral);
        expect(result).toContain(sentence);
        expect(result).toContain(langGeneral);
        // Ensure step titles are present
        expect(result).toContain('Fluent Translation');
    });

    it('should generate grammar analysis prompt with sentence and language', () => {
        const result = getGrammarAnalysisPrompt(sentence, langGeneral);
        expect(result).toContain(sentence);
        expect(result).toContain('Parts of Speech');
    });

    it('should generate vocabulary expansion prompt with sentence and language', () => {
        const result = getVocabularyExpansionPrompt(sentence, langGeneral);
        expect(result).toContain(sentence);
        expect(result).toContain('Key Vocabulary');
    });

    it('should generate context nuance prompt with sentence and language', () => {
        const result = getContextNuancePrompt(sentence, langGeneral);
        expect(result).toContain(sentence);
        expect(result).toContain('Formality Level');
    });

    it('should generate creative practice prompt with sentence and language', () => {
        const result = getCreativePracticePrompt(sentence, langGeneral);
        expect(result).toContain(sentence);
        expect(result).toContain('Fill in the Blank');
    });

    it('should generate pronunciation analysis prompt with sentence and language', () => {
        const result = getPronunciationAnalysisPrompt(sentence, langGeneral);
        expect(result).toContain(sentence);
        expect(result).toContain('Overall Score');
    });
});
