import { BaseModal } from "./BaseModal";
import { User } from "../../models";

export class AssignToSubAdminModal extends BaseModal {
    private form: HTMLFormElement;
    private subAdminSelect: HTMLSelectElement;
    
    constructor(subAdmins: User[]) {
        super('assignToSubAdminModal');
        
        this.render(subAdmins);
        this.form = this.modalElement.querySelector('#assignTaskForm') as HTMLFormElement;
        this.subAdminSelect = this.modalElement.querySelector('#subAdminSelect') as HTMLSelectElement;

        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });
    }

    private render(subAdmins: User[]) {
        const title = "Assigner la Tâche";
        const body = document.createElement('div');
        body.innerHTML = `
            <form id="assignTaskForm">
                <input type="hidden" id="taskIdToAssign">
                <div class="mb-4">
                    <label class="form-label" for="subAdminSelect">Choisir un Sous-Administrateur</label>
                    <select id="subAdminSelect" class="form-select"></select>
                </div>
                <div class="mb-4">
                    <label class="form-label" for="assignNotes">Notes (optionnel)</label>
                    <textarea id="assignNotes" class="form-textarea" rows="2"></textarea>
                </div>
            </form>`;
        
        const footer = document.createElement('div');
        footer.className = 'flex justify-end space-x-2';
        footer.innerHTML = `
            <button type="button" class="btn btn-secondary" data-modal-close>Annuler</button>
            <button type="submit" form="assignTaskForm" class="btn btn-primary">Assigner</button>`;
        
        this.setContent(title, body, footer);
        
        const select = this.modalElement.querySelector('#subAdminSelect') as HTMLSelectElement;
        subAdmins.forEach(sa => {
            select.add(new Option(sa.name, sa.id));
        });
    }

    public show(taskId: string) {
        (this.modalElement.querySelector('#taskIdToAssign') as HTMLInputElement).value = taskId;
        super.show();
    }

    private handleSubmit() {
        const taskId = (this.modalElement.querySelector('#taskIdToAssign') as HTMLInputElement).value;
        const assignToId = this.subAdminSelect.value;
        const notes = (this.modalElement.querySelector('#assignNotes') as HTMLTextAreaElement).value;

        // Dispatch an event to be caught by the view
        this.modalElement.dispatchEvent(new CustomEvent('taskAssigned', {
            detail: { taskId, assignToId, notes },
            bubbles: true,
            composed: true
        }));

        this.hide();
    }
}