package com.ovaltrack.backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

// Sin envíos reales ni API key: el contexto arranca con el transporte que solo loguea
@SpringBootTest(properties = "ovaltrack.mail.provider=log")
class BackendApplicationTests {

	@Test
	void contextLoads() {
	}

}
