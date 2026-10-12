const router = require('express').Router();
router.get('/:id', (req, res) => res.json({ id: req.params.id }));
router.delete('/:id', (req, res) => res.sendStatus(204));
module.exports = router;
