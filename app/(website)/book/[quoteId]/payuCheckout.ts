/** Client helper: auto-submit a hidden form to PayU's hosted payment page. */
export function submitPayuForm(actionUrl: string, fields: Record<string, string>): void {
    if (typeof document === "undefined") return;
    const form = document.createElement("form");
    form.method = "POST";
    form.action = actionUrl;
    for (const [name, value] of Object.entries(fields)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
}
