class PersonalNote {
    constructor({
        noteId,
        projectId,
        title = null,
        content,
        createdAt = null,
        updatedAt = null
    }) {
        this.noteId = noteId;
        this.projectId = projectId;
        this.title = title;
        this.content = content;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    updateContent(content) {
        this.content = content;
        this.updatedAt = new Date().toISOString();
    }

    isBlank() {
        return !String(this.content || '').trim();
    }
}

module.exports = PersonalNote;