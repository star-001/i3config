var finalText = "";
$(function () {
    $('[data-action="Encode"]').click(function () {
        $("#error").empty();
        try {
            finalText = btoa($("#Source").val());
            $("#Source").val(finalText);
        } catch (e) {
            $("#error").html("<b>Error encodig</b>");
        }
	});

    $('[data-action="Decode"]').click(function () {
        $("#error").empty();
        try {
            finalText = atob($("#Source").val());
            $("#Source").val(finalText);
        } catch (e) {
            $("#error").html("<b>Error decoding</b>");
        }
	});
	
		$('[data-action="ToHex"]').click(function () {
        $("#error").empty();
        try {
            finalText = btoa($("#Source").val());
			var raw = atob(finalText);
				var hex = '';
				for (i = 0; i < raw.length; i++ ) {
					var _hex = raw.charCodeAt(i).toString(16)
					hex += (_hex.length==2?_hex:'0'+_hex);
				}

				$("#Source").val(hex.toUpperCase());
        } catch (e) {
            $("#error").html("<b>Error encodig</b>");
        }
	}),
	$('[data-action="ToText"]').click(function () {
        $("#error").empty();
        try {
           var hex  = $("#Source").val();
			var str = '';
			for (var n = 0; n < hex.length; n += 2) {
				str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
			}
	
			$("#Source").val(str);
		
		   
        } catch (e) {
            $("#error").html("<b>Error encodig</b>");
        }
	})

});
