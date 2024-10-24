const mongoose = require('mongoose');

const storySchema = new mongoose.Schema({
    storyName: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    integrations: {
        type: String,
        required: true,
    },
    complementaryDatasets: {
        type: String,
        required: true,
    },
    storyCreatedBy: {
        type: String,
        required: true,
    },
}, {
    timestamps: true,
});

const Story = mongoose.model('Story', storySchema);
module.exports = Story;
