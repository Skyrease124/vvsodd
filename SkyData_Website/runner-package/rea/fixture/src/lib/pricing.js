require('fs').writeFileSync(__dirname + '/EXECUTED.txt', 'pricing.js was executed');
exports.priceOf = (order) => order.items.reduce((s, i) => s + i.price, 0);
