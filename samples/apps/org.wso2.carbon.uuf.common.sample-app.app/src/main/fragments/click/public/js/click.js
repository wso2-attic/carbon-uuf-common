function initScript() {
    $('#message-landing-zone').on('click', function (event) {
        // This will prevent event triggering more then once
        if (event.handled !== true && (event.target.tagName.toLowerCase()) == 'button') {
            var inputValue = $(event.target).closest('.wrapper').find('.input').val();
            alert('Hello ' + inputValue);
            event.handled = true;
        }
    });
}