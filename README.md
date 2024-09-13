# ajaxify
Patches the response of an hyperlink into the current page, like a div or bootstrap modal, without using IFrames.

## Dependencies

* jQuery
* Bootstrap 3-5 (not necessary)

## Example

The response of this link will be opened in a bootstrap modal:

`<a href="/my-url" title="This is a modal" class="ajaxify">Open my url in a modal!</a>`

Specify a `data-target-container-selector` to open the link in your own HTML element instead:

`<a href="/my-url" class="ajaxify" data-target-container-selector="#my-container">Open my url in a div!</a>`

## Configuration settings

The following attributes can be added to the `<a>` element:

| Attribute name | Description |
| - | - |
| `title` | The title of the modal, if `data-target-container-selector` is not specified. Will be rendered as  `<h5>` in the `.modal-header`. |
| `href` / `data-target` | The URL to open. |
| `data-modal-size` | Optional, possible values „small“ or „large“. Ignored, when `data-target-container-selector` is specified. |
| `data-content-selector` | Optional. DOM selector for the response document for the content that should be cut out and patched inside the target element. By default, a `<main>` element will be searched. If neither it, or the selector exists, the whole `<body>` will be taken. |
| `data-handle-form-submit`	| Optional. When `true`, the `action` of `<form>`s will be performed as AJAX requests and patched into the current document, instead of replacing the page. This has limitations, amongst others, forms with `enctype=multipart/form-data` won't work. Default is `false`. |
| `data-target-container-selector` | Optional. DOM selector for a target element, in which the response should be patched into. When not specified, a bootstrap modal will be used. |

## Events

| Event name | Description |
| - | - |
| `ajaxify:opening` | Triggered when a request has been started, before the response has been received. |
| `ajaxify:ajax-content-loaded` | Triggered when the request is complete and the response could be parsed. When the request was not successful, this event may not be fired. This event is suitable to perform page initialization code that would otherwise occur in the `document.ready` event or on `window.load`. |
| `ajaxify:opened` | Triggered after the request has completed, and the target element has been opened. This event also fires, when `ajax-content-loaded` has not been fired (i.e. a non-200 status code was received). |
| `ajaxify:cleared` | Triggered when the contents of the target are cleared, or being replaced by a subsequent request. |
| `ajaxify:close` | This event is not issued by the component, but can be triggered by the developer to manually close the target / modal. This implicitly calls the events `modal-closing` and `modal-closed`. This is useful when you provide your own `data-target-container-selector` and have to implement your own close button. Fire this event on the `.ajax-response-target` (the child element of your `data-target-container-selector`) you want to close. For example: `<button type="button" onclick="$(this).closest('.ajax-response-target').trigger('modal:modal-close')">Close</button>` |
| `ajaxify:closing` | Triggered after a close operation on the target has been issued. |
| `ajaxify:closed` | Triggered after the target has been closed. Suitable for reloading the page after an edit operation. |
