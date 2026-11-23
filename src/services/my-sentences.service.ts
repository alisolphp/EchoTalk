import $ from 'jquery';
import { Modal } from 'bootstrap';
import { EchoTalkApp } from '../app';
import {
    MySentence, SaveResult, SAVE_ERROR_MESSAGES, loadSentences, addSentence, updateSentence, removeSentence,
} from '../utils/my-sentences';

/**
 * "My Sentences": the user's own sentences, saved on the device and listed in a modal
 * where they can be practiced, edited or deleted. All text is rendered with textContent.
 */
export class MySentencesService {
    private app: EchoTalkApp;
    private editingId: string | null = null;

    constructor(app: EchoTalkApp) {
        this.app = app;
    }

    /** Opens the modal with the current list. */
    public show(): void {
        this.cancelEdit();
        this.setMessage('', 'info');
        this.render();
        Modal.getOrCreateInstance($('#mySentencesModal')[0]).show();
    }

    /** Saves the text of the main sentence box ("Save to My Sentences" on the setup page). */
    public saveFromInput(): void {
        const text = String($('#sentenceInput').val() ?? '');
        const result = addSentence(text, this.app.lang);
        this.setSetupMessage(result.ok ? 'Saved to My Sentences.' : SAVE_ERROR_MESSAGES[result.error], result.ok ? 'success' : 'warning');
        if (result.ok) this.render();
    }

    /** Add or save-edit from the modal form. */
    public submitForm(): void {
        const text = String($('#mySentenceText').val() ?? '');
        const result: SaveResult = this.editingId
            ? updateSentence(this.editingId, text)
            : addSentence(text, this.app.lang);
        if (!result.ok) {
            this.setMessage(SAVE_ERROR_MESSAGES[result.error], 'warning');
            return;
        }
        const wasEditing = this.editingId !== null;
        this.cancelEdit();
        this.setMessage(wasEditing ? 'Sentence updated.' : 'Sentence added.', 'success');
        this.render();
        $('#mySentenceText').trigger('focus');
    }

    private startEdit(item: MySentence): void {
        this.editingId = item.id;
        $('#mySentenceText').val(item.text).trigger('focus');
        $('#mySentenceSubmit').text('Save changes');
        $('#mySentenceCancel').removeClass('d-none');
    }

    public cancelEdit(): void {
        this.editingId = null;
        $('#mySentenceText').val('');
        $('#mySentenceSubmit').text('Add sentence');
        $('#mySentenceCancel').addClass('d-none');
    }

    private async practice(item: MySentence): Promise<void> {
        // Same path as "Practice this sentence" in My Practices (language switch, then start).
        const started = await this.app.startPracticeFrom(item.text, item.lang || this.app.lang);
        if (!started) return; // keep the list open when the language data failed to load
        const modalEl = $('#mySentencesModal')[0];
        if (modalEl) Modal.getOrCreateInstance(modalEl).hide();
    }

    private remove(item: MySentence): void {
        if (!window.confirm('Delete this sentence from My Sentences? Your practice history is not affected.')) return;
        if (this.editingId === item.id) this.cancelEdit();
        removeSentence(item.id);
        this.setMessage('Sentence deleted.', 'success');
        this.render();
        $('#mySentenceText').trigger('focus');
    }

    /** Rebuilds the list from storage. */
    public render(): void {
        const items = loadSentences();
        const $list = $('#mySentencesList').empty();
        $('#mySentencesCount').text(items.length === 0 ? '' : `${items.length} saved`);
        if (items.length === 0) {
            $list.append($('<p class="text-muted mb-0"></p>').text('Nothing saved yet. Add a sentence above, or use "Save to My Sentences" on the practice page.'));
            return;
        }
        items.forEach(item => {
            const $row = $('<li class="list-group-item d-flex flex-wrap align-items-center gap-2"></li>');
            $row.append($('<div class="flex-grow-1" dir="auto" style="white-space: pre-line;"></div>').text(item.text));
            const label = item.text.length > 40 ? item.text.slice(0, 40) + '...' : item.text;
            $row.append($('<button type="button" class="btn btn-sm btn-primary"></button>')
                .attr('aria-label', `Practice: ${label}`).text('Practice').on('click', () => this.practice(item)));
            $row.append($('<button type="button" class="btn btn-sm btn-outline-light"></button>')
                .attr('aria-label', `Edit: ${label}`).text('Edit').on('click', () => this.startEdit(item)));
            $row.append($('<button type="button" class="btn btn-sm btn-outline-danger"></button>')
                .attr('aria-label', `Delete: ${label}`).text('Delete').on('click', () => this.remove(item)));
            $list.append($row);
        });
    }

    private setMessage(text: string, kind: 'info' | 'success' | 'warning'): void {
        const $m = $('#mySentencesMessage');
        $m.text(text).removeClass('text-success text-warning text-muted').addClass(kind === 'success' ? 'text-success' : kind === 'warning' ? 'text-warning' : 'text-muted');
    }

    private setSetupMessage(text: string, kind: 'success' | 'warning'): void {
        $('#saveSentenceMessage').text(text).removeClass('text-success text-warning').addClass(kind === 'success' ? 'text-success' : 'text-warning');
    }
}
