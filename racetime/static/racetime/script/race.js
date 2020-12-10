function Race() {
    this.socketListeners = {
        close: this.onSocketClose.bind(this),
        error: this.onSocketError.bind(this),
        message: this.onSocketMessage.bind(this),
        open: this.onSocketOpen.bind(this)
    };
    this.messageIDs = [];
    this.notify = false;
    this.latency = {
        lastUpdated: 0,
        value: 0,
        version: 0,
    }

    const debounce = (func, delay) => {
        let inDebounce;
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(inDebounce);
            inDebounce = setTimeout(() => func.apply(context, args), delay)
        }
    };

    try {
        if ($('.race-chat').length) {
            var self = this;
            $(document).on('click', '.race-chat .scrollwarning', function() {
                self.scrollToBottom();
            });
            $('.race-chat .messages').on('scroll', debounce(function() {
                if (self.shouldScroll()) {
                    self.scrollToBottom();
                }
            }, 50));
        }
    } catch (e) {
        if ('notice_exception' in window) {
            window.notice_exception(e);
        } else {
            throw e;
        }
    }
    try {
        this.vars = JSON.parse($('#race-vars').text());
        if (this.vars.user.name) {
            this.vars.user.name_quoted = this.regquote(this.vars.user.name);
        }
        var server_date = new Date(this.vars.server_time_utc);
        if ($('.race-chat').length) {
            for (var i in this.vars.chat_history) {
                if (!this.vars.chat_history.hasOwnProperty(i)) continue;
                this.addMessage(this.vars.chat_history[i], server_date, true);
            }
            this.scrollToBottom();
        }
        this.open();
    } catch (e) {
        if ('notice_exception' in window) {
            window.notice_exception(e);
        } else {
            throw e;
        }
    }
}

Race.prototype.ajaxifyActionForm = function(form) {
    if ($(form).find('[name="csrfmiddlewaretoken"]').length === 0) {
        $('<input type="hidden" name="csrfmiddlewaretoken">')
            .attr('value', Cookies.get('csrftoken'))
            .appendTo(form);
    }
    var self = this;
    $(form).ajaxForm({
        clearForm: true,
        beforeSubmit: function() {
            $('.race-action-form button').prop('disabled', true);
        },
        beforeSerialize: function($form) {
            if ($form.hasClass('add_comment') || $form.hasClass('change_comment')) {
                var comment = prompt('Enter a comment:');
                if (!comment) return false;
                var $input = $('<input type="hidden" name="comment">');
                $input.val(comment);
                $input.appendTo($form);
            }
        },
        error: self.onError.bind(self)
    });
};

Race.prototype.shouldScroll = function() {
    var messages = $('.race-chat .messages')[0];
    var pos = messages.scrollHeight - (messages.scrollTop + messages.clientHeight);
    return pos < 20;
};

Race.prototype.scrollToBottom = function() {
    $('.race-chat').removeClass('scrollwarning');
    var messages = $('.race-chat .messages')[0];
    messages.scrollTop = messages.scrollHeight;
};

Race.prototype.addMessage = function(message, server_date, mute_notifications) {
    var self = this;

    // Temporary fix: skip countdown messages intended for LiveSplit
    if (message.is_system && message.message.match(/^\d+…$/)) {
        return true;
    }

    if (self.messageIDs.indexOf(message.id) !== -1) {
        return true;
    }

    var $messages = $('.race-chat .messages');
    if ($messages.length) {
        var shouldScroll = self.shouldScroll();
        $messages.append(self.createMessageItem(message, server_date, mute_notifications));
        if (shouldScroll || (message.user && this.vars.user.id === message.user.id)) {
            self.scrollToBottom();
        } else {
            $('.race-chat').addClass('scrollwarning');
        }
    }

    self.messageIDs.push(message.id);

    if (self.messageIDs.length > 100) {
        self.messageIDs.shift();
    }
    if ($messages.children().length > 100) {
        $messages.children().first().remove();
    }
};

Race.prototype.createMessageItem = function(message, server_date, mute_notifications) {
    var posted_date = new Date(message.posted_at);
    var timestamp = ('00' + posted_date.getHours()).slice(-2) + ':' + ('00' + posted_date.getMinutes()).slice(-2);

    var $li = $(
        '<li data-id="' + message.id + '">'
        + '<span class="timestamp">' + timestamp + '</span> '
        + '<span class="message"></span>'
        + '</li>'
    );

    if (message.is_system) {
        $li.addClass('system');
    } else if (message.is_bot) {
        $li.addClass('bot');
        var $bot = $('<span class="name"></span>');
        $bot.text(message.bot);
        $('<span />').text(message.bot).appendTo($bot.find('.name'));
        $bot.add('<span class="name-after">: </span>').insertBefore(
            $li.children('.message')
        );
    } else {
        $li.attr('data-userid', message.user.id);
        var $user = $('<span class="name"></span>');
        $user.addClass(message.user.flair);
        $('<span />').text(message.user.name).appendTo($user);
        $user.add('<span class="name-after">: </span>').insertBefore(
            $li.children('.message')
        );
    }
    if (message.highlight) {
        $li.addClass('highlight')
    }
    var $message = $li.children('.message');
    $message.text(message.message);
    if (message.is_system) {
        $message.html($message.html().replace(/##(\w+?)##(.+?)##/g, function(match, $1, $2) {
            return '<span class="' + $1 + '">' + $2 + '</span>';
        }));
    }
    $message.html($message.html().replace(/https?:\/\/[^\s]+/g, function(match) {
        return '<a href="' + match + '" target="_blank">' + match + '</a>';
    }));
    if (this.vars.user.name_quoted && !message.is_system) {
        var foundMention = false;
        var searchFor = [];
        if (message.is_bot || message.user.id !== this.vars.user.id) {
            searchFor.push('\\b' + this.vars.user.name_quoted);
        }
        if (message.is_bot || message.is_monitor) {
            searchFor.push('@everyone', '@here');
            if (this.vars.user.in_race) {
                searchFor.push('@entrants?');
                if (this.vars.user.ready) {
                    searchFor.push('@ready');
                }
                if (this.vars.user.unready) {
                    searchFor.push('@notready', '@unready');
                }
            }
        }
        if (searchFor.length > 0) {
            var search = new RegExp('(' + searchFor.join('|') + ')\\b', 'gi');
            $message[0].childNodes.forEach(function(text) {
                if (text.nodeType !== Node.TEXT_NODE) return;
                var span = document.createElement('span');
                span.classList.add('mention-search');
                span.textContent = text.textContent;
                text.parentNode.replaceChild(span, text);
            });
            $message.find('.mention-search').each(function() {
                $(this).html($(this).html().replace(search, function(match) {
                    foundMention = true;
                    return '<span class="mention">' + match + '</span>';
                }));
            });
        }
        if (foundMention) {
            $li.addClass('mentioned');
            if (this.notify && !mute_notifications && (message.is_bot || message.user.id !== this.vars.user.id)) {
                if (message.is_bot) {
                    new Notification(this.vars.room, {
                        body: message.bot + ': ' + $message.text(),
                        silent: true,
                        tag: message.id,
                    });
                } else {
                    new Notification(this.vars.room, {
                        body: message.user.name + ': ' + $message.text(),
                        icon: message.user.avatar,
                        silent: true,
                        tag: message.id,
                    });
                }
            }
        }
    }

    if (!message.is_system && this.vars.user.can_moderate) {
        var $modactions = $('<span class="mod-actions"></span>');
        $modactions.append('<span class="material-icons" data-action="delete" title="Delete this message">delete</span>');
        if (!message.is_bot) {
            $modactions.append('<span class="material-icons" data-action="purge" title="Purge all messages">block</span>');
        }
        $modactions.insertAfter($li.children('.timestamp'));
    }

    //If the posted date is after the server date, assume the message posted at server time
    var ms_since_posted = Math.max(0, server_date - posted_date);
    var remaining_delay = (message.delay * 1000) - ms_since_posted;

    if (remaining_delay > 0 && !((message.user && this.vars.user.id === message.user.id) || this.vars.user.can_monitor)) {
        $li.hide();
        setTimeout(function() {
            $li.show();
            var $messages = $('.race-chat .messages');
            $messages[0].scrollTop = $messages[0].scrollHeight
        }, remaining_delay);
    }

    return $li;
};

Race.prototype.deleteMessage = function(messageID, userID) {
    if (messageID) {
        var $messages = $('.race-chat .messages').children('[data-id="' + messageID + '"]');
    } else if (userID) {
        var $messages = $('.race-chat .messages').children('[data-userid="' + userID + '"]');
    } else {
        throw 'Must supply message ID or user ID';
    }
    $messages = $messages.not('.deleted');
    if ($messages.length === 0) return;
    var can_moderate = this.vars.user.can_moderate;
    $messages.each(function() {
        $(this).addClass('deleted');
        var $deleted = $('<span class="deleted">message deleted</span>').insertAfter(
            $(this).children('.message')
        );
        if (can_moderate) {
            $deleted.attr('title', 'Message deleted. Click to view original message.');
            $(this).children('.message').attr('title', 'Message was deleted by a moderator.');
        } else {
            $deleted.attr('title', 'Message was deleted by a moderator.');
            $(this).children('.message').remove();
        }
        $(this).children('.mod-actions').remove();
    });
};

Race.prototype.guid = function() {
    return Math.random().toString(36).substring(2, 15)
        + Math.random().toString(36).substring(2, 15);
};

Race.prototype.getHistory = function() {
    clearTimeout(this.catchupTimeout);
    this.catchupTimeout = setTimeout(function() {
        try {
            this.chatSocket.send(JSON.stringify({
                action: 'gethistory',
                data: {
                    last_message: this.messageIDs[this.messageIDs.length - 1] || null
                },
            }));
        } catch (e) {}
    }.bind(this), 1000);
};

Race.prototype.heartbeat = function() {
    clearTimeout(this.pingTimeout);
    clearTimeout(this.pongTimeout);
    this.pingTimeout = setTimeout(function() {
        try {
            this.chatSocket.send(JSON.stringify({
                'action': 'ping'
            }));
        } catch (e) {}
    }.bind(this), 20000);
    this.pongTimeout = setTimeout(function() {
        this.chatSocket.close();
    }.bind(this), 30000);
};

Race.prototype.onError = function(xhr) {
    var self = this;
    if (xhr.status === 422) {
        if (xhr.responseJSON && 'errors' in xhr.responseJSON) {
            xhr.responseJSON.errors.forEach(function(msg) {
                self.whoops(msg);
            });
        } else {
            self.whoops(xhr.responseText);
        }
        $('.race-action-form button').prop('disabled', false);
    } else {
        self.whoops(
            'Something went wrong (code ' + xhr.status + '). ' +
            'Reload the page to continue.'
        );
    }
};

Race.prototype.onSocketClose = function(event) {
    $('.race-chat').addClass('disconnected');
    this.reconnect();
};

Race.prototype.onSocketError = function(event) {
    $('.race-chat').addClass('disconnected');
    this.reconnect();
};

Race.prototype.onSocketMessage = function(event) {
    try {
        var data = JSON.parse(event.data);
    } catch (e) {
        if ('notice_exception' in window) {
            window.notice_exception(e);
            return;
        } else {
            throw e;
        }
    }

    this.heartbeat();

    var server_date = new Date(data.date);
    switch (data.type) {
        case 'race.data':
            if (this.vars.user.id) {
                var entrant = data.race.entrants.filter(e => e.user.id === this.vars.user.id)[0]
                if (entrant) {
                    this.vars.user.in_race = [
                        'requested',
                        'invited',
                        'declined',
                    ].indexOf(entrant.status.value) === -1;
                    this.vars.user.ready = [
                        'ready',
                        'in_progress',
                        'done',
                        'dnf',
                        'dq',
                    ].indexOf(entrant.status.value) !== -1;
                    this.vars.user.unready = entrant.status.value === 'not_ready';
                } else {
                    this.vars.user.in_race = false;
                    this.vars.user.ready = false;
                    this.vars.user.unready = false;
                }
                if (!this.vars.user.can_moderate) {
                    this.vars.user.can_monitor = Boolean(data.race.monitors.some(user => user.id === this.vars.user.id));
                }
            }
            break;
        case 'race.renders':
            if (data.version > this.latency.version && (Date.now() - this.latency.lastUpdated) > 1000) {
                this.latency = {
                    lastUpdated: Date.now(),
                    value: server_date - Date.now(),
                    version: data.version,
                }
                window.globalLatency = this.latency.value;
            }
            this.handleRenders(data.renders, data.version);
            if (this.vars.user.can_moderate || this.vars.user.can_monitor || !('actions' in data.renders)) {
                this.raceTick();
            }
            break;
        case 'chat.history':
            data.messages.forEach(function(message) {
                this.addMessage(message, server_date, false);
            }.bind(this));
            break;
        case 'chat.message':
            this.addMessage(data.message, server_date, false);
            break;
        case 'chat.delete':
            this.deleteMessage(data.delete.id, null);
            if (this.vars.user.can_moderate) {
                this.whoops(
                    data.delete.deleted_by.name + ' deleted a message from '
                    + (data.delete.is_bot ? data.delete.bot : data.delete.user.name) + '.',
                    'system',
                    false
                );
            }
            break;
        case 'chat.purge':
            this.deleteMessage(null, data.purge.user.id);
            if (this.vars.user.can_moderate) {
                this.whoops(
                    data.purge.purged_by.name + ' purged all messages from '
                    + data.purge.user.name + '.',
                    'system',
                    false
                );
            }
            break;
    }
};

Race.prototype.onSocketOpen = function(event) {
    $('.race-chat').removeClass('disconnected');
};

Race.prototype.open = function() {
    var proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
    this.chatSocket = new WebSocket(proto + location.host + this.vars.urls.chat);
    for (var type in this.socketListeners) {
        this.chatSocket.addEventListener(type, this.socketListeners[type]);
    }
    this.heartbeat();
};

Race.prototype.handleRenders = function(renders, version) {
    var self = this;
    requestAnimationFrame(function() {
        for (var segment in renders) {
            if (!renders.hasOwnProperty(segment)) continue;
            var $segment = $('.race-' + segment);
            if ($segment.attr('data-version') >= version) continue;
            switch (segment) {
                case 'streams':
                    // streams segment is handled in race_spectate.js
                    $segment.attr('data-version', version);
                    break;
                case 'entrants_monitor':
                    $('<div />').html(renders[segment]).children().each(function() {
                        var $entrant = $('.race-entrants [data-entrant="' + $(this).data('entrant') + '"]');
                        if ($entrant.length === 0) return true;
                        var $monitorActions = $entrant.children('.monitor-actions');
                        if ($monitorActions.length === 0) {
                            $monitorActions = $('<div class="monitor-actions empty" data-version="0"></div>').appendTo($entrant);
                        }
                        if ($monitorActions.attr('data-version') < version) {
                            $monitorActions.empty().append(this);
                            if ($(this).children().length === 0) {
                                $monitorActions.addClass('empty');
                            } else {
                                $monitorActions.removeClass('empty');
                            }
                            $monitorActions.attr('data-version', version);
                            $(this).find('.race-action-form').each(function() {
                                self.ajaxifyActionForm(this);
                            });
                        }
                    });
                    break;
                default:
                    $segment.html(renders[segment]);
                    $segment.attr('data-version', version);
                    window.localiseDates.call($segment[0]);
                    window.addAutocompleters.call($segment[0]);
                    $segment.find('.race-action-form').each(function() {
                        self.ajaxifyActionForm(this);
                    });
                    if (segment === 'entrants' && self.vars.user.can_monitor) {
                        $segment.find('.entrant-row').each(function() {
                            $(this).append('<div class="monitor-actions empty" data-version="0"></div>');
                        });
                    }
            }
            $segment.trigger('raceTick', renders[segment]);
        }
        // This is kind of a fudge but replacing urlize is awful.
        $('.race-info .info a').each(function() {
            $(this).attr('target', '_blank');
        });
    });
};

Race.prototype.raceTick = function() {
    var self = this;
    $.get(self.vars.urls.renders, function(data, status, xhr) {
        if (xhr.getResponseHeader('X-Date-Exact')) {
            window.globalLatency = new Date(xhr.getResponseHeader('X-Date-Exact')) - new Date();
        }
        self.handleRenders(data.renders, data.version);
    });
};

Race.prototype.reconnect = function() {
    for (var type in this.socketListeners) {
        this.chatSocket.removeEventListener(type, this.socketListeners[type]);
    }

    setTimeout(function() {
        this.open();
        this.getHistory();
    }.bind(this), 1000);
};

Race.prototype.whoops = function(message, cls = 'error', forceScroll = true) {
    var $messages = $('.race-chat .messages');
    var date = new Date();
    var timestamp = ('00' + date.getHours()).slice(-2) + ':' + ('00' + date.getMinutes()).slice(-2);
    var $li = $(
        '<li>' +
        '<span class="timestamp">' + timestamp + '</span> ' +
        '<span class="message"></span>' +
        '</li>'
    );
    $li.addClass(cls);
    $li.find('.message').text(message);
    var shouldScroll = forceScroll || this.shouldScroll();
    $messages.append($li);
    if (shouldScroll) {
        this.scrollToBottom();
    } else {
        $('.race-chat').addClass('scrollwarning');
    }
};

Race.prototype.regquote = function(str) {
    return str.replace(
        new RegExp('[.\\\\+*?\\[^\\]$(){}=!<>|:\\/-]', 'g'),
        '\\$&'
    );
};

$(function() {
    var race = new Race();
    window.race = race;

    if (race.vars.user.can_moderate) {
        $('.race-chat').addClass('can-moderate');
    }

    if ('Notification' in window && Notification.permission === 'granted') {
        race.notify = localStorage.getItem('raceNotifications') !== 'false';
        if (race.notify) {
            $('.race-chat .notifications').addClass('on');
        }
    }

    $('.race-action-form').each(function() {
        race.ajaxifyActionForm(this);
    });

    var guid = race.guid();
    var sending = null;
    $('.race-chat form').ajaxForm({
        beforeSubmit: function(data, $form) {
            var message = $form.find('[name="message"]').val().trim();
            if (message === '' || message === sending) {
                return false;
            }
            data.push({ name: 'guid', value: guid });
            sending = message;
        },
        complete: function() {
            guid = race.guid();
            sending = null;
        },
        error: race.onError.bind(race),
        success: function() {
            $('.race-chat form textarea').val('').height(18);
        }
    });

    $(document).on('click', '.race-chat > .messages > li.deleted > .deleted', function() {
        if ($(this).prev('.message') && race.vars.user.can_moderate) {
            $(this).closest('li').toggleClass('show-delete');
        }
    });
    $(document).on('click', '.race-chat > .messages > li.deleted > .message', function() {
        $(this).closest('li').toggleClass('show-delete');
    });

    $(document).on('click', '.race-chat .mod-actions > span', function() {
        var url = race.vars.urls[$(this).data('action')];
        url = url.replace('$0', $(this).closest('li').data('id'));
        $.post({
            url: url,
            data: {'csrfmiddlewaretoken': Cookies.get('csrftoken')},
            error: race.onError.bind(race),
        });
    });

    $(document).on('keydown', '.race-chat form textarea', function(event) {
        if (event.which === 13) {
            if ($(this).val()) {
                $(this).closest('form').submit();
            }
            return false;
        }
    });

    $(document).on('change input keyup', '.race-chat form textarea', function() {
        if ($(this).val() === '') {
            $(this).height(18);
        } else {
            $(this).height($(this)[0].scrollHeight - 12);
        }
    });

    $(document).on('click', '.confirm .btn, .dangerous .btn', function() {
        return confirm($(this).text().trim() + ': are you sure you want to do that?');
    });

    $(document).on('click', '.race-nav > ul > li', function() {
        $('body').removeClass(function(index, className) {
            return (className.match(/(^|\s)race-nav-\S+/g) || []).join(' ');
        }).addClass('race-nav-' + $(this).data('nav'));
        $(this).addClass('active').siblings().removeClass('active');
    });

    $(document).on('click', '.race-chat .moderation', function() {
        $('body').toggleClass('show-mod-actions');
    });

    $(document).on('click', '.race-chat .notifications', function() {
        if (!('Notification' in window)) {
            alert('Sorry, your browser does not support notifications.');
            return;
        }
        if (Notification.permission !== 'granted') {
            var then = (perm) => {
                race.notify = perm === 'granted';
                localStorage.setItem('raceNotifications', race.notify);
                $(this)[race.notify ? 'addClass' : 'removeClass']('on');
            };
            try {
                Notification.requestPermission().then(then);
            } catch (e) {
                Notification.requestPermission(then);
            }
        } else {
            race.notify = !race.notify;
            localStorage.setItem('raceNotifications', race.notify);
            $(this)[race.notify ? 'addClass' : 'removeClass']('on');
        }
    });
});
